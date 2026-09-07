// Copyright (c) 2026 RobotWebTools Contributors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import createDebug from 'debug';
import { toJSONSafe, reviveBigInts } from '../message_serialization.js';
import ActionClient from '../action/client.js';
import ActionInterfaces from '../action/interfaces.js';
import ActionUuid from '../action/uuid.js';

const debug = createDebug('rclnodejs:runtime');

const ACTION_DISCONNECT_GRACE_MS = 30 * 1000;

/**
 * Per-connection request handler. Statelessly routes inbound capability
 * frames to the registered ROS 2 endpoints, lazily creating publishers,
 * subscriptions, and clients on first use and tearing them down on close.
 *
 * Rejects any frame whose capability is not in the {@link CapabilityRegistry}
 * — this is the security contract that distinguishes the runtime from the
 * raw rosocket gateway.
 */
class Dispatcher {
  /**
   * @param {object} options
   * @param {import('../node.js')} options.node
   * @param {import('./capability_registry.js').CapabilityRegistry} options.registry
   */
  constructor({ node, registry }) {
    if (!node) throw new TypeError('Dispatcher: options.node is required');
    if (!registry)
      throw new TypeError('Dispatcher: options.registry is required');
    this.node = node;
    this.registry = registry;
  }

  /**
   * Bind handlers for a freshly-accepted connection. The dispatcher takes
   * full ownership of the connection's lifecycle from this point on.
   * @param {import('./connection.js').Connection} conn
   */
  handle(conn) {
    const state = {
      publishers: new Map(), //     capability name -> Publisher
      subscriptions: new Map(), //  subId           -> { name, Subscription }
      clients: new Map(), //        capability name -> Client
      actionClients: new Map(), //  capability name -> ActionClient
      pendingGoals: new Map(), //   goal id         -> capability name
      pendingCancels: new Map(), // token           -> capability name
      goals: new Map(), //          goal id         -> { name, goalHandle }
      closed: false,
      expired: false,
      cleanupTimer: null,
    };

    const cleanup = () => {
      if (state.closed) return;
      state.closed = true;
      for (const { subscription } of state.subscriptions.values()) {
        try {
          this.node.destroySubscription(subscription);
        } catch {
          /* destroy is best-effort during connection teardown */
        }
      }
      state.subscriptions.clear();
      for (const pub of state.publishers.values()) {
        try {
          this.node.destroyPublisher(pub);
        } catch {
          /* destroy is best-effort during connection teardown */
        }
      }
      state.publishers.clear();
      for (const cli of state.clients.values()) {
        try {
          this.node.destroyClient(cli);
        } catch {
          /* destroy is best-effort during connection teardown */
        }
      }
      state.clients.clear();
      if (state.actionClients.size > 0) {
        state.cleanupTimer = setTimeout(() => {
          state.expired = true;
          state.pendingGoals.clear();
          state.pendingCancels.clear();
          state.goals.clear();
          for (const name of state.actionClients.keys()) {
            _releaseActionClientIfIdle(state, name);
          }
        }, ACTION_DISCONNECT_GRACE_MS);
        state.cleanupTimer.unref();
      }
      setImmediate(() => {
        for (const name of state.actionClients.keys()) {
          _releaseActionClientIfIdle(state, name);
        }
      });
    };

    conn.on('close', cleanup);
    conn.on('message', (frame) => this._dispatchFrame(conn, frame, state));
  }

  _dispatchFrame(conn, frame, state) {
    if (state.closed) return;
    if (!frame || typeof frame !== 'object') {
      conn.send({
        ok: false,
        error: 'invalid frame: expected JSON object',
        code: 'invalid_frame',
      });
      return;
    }
    const { id, kind, capability } = frame;
    try {
      switch (kind) {
        case 'call':
          return this._handleCall(conn, id, capability, frame.payload, state);
        case 'publish':
          return this._handlePublish(
            conn,
            id,
            capability,
            frame.payload,
            state
          );
        case 'subscribe':
          return this._handleSubscribe(conn, id, capability, state);
        case 'unsubscribe':
          return this._handleUnsubscribe(conn, id, frame.subId, state);
        case 'action':
          return this._handleAction(conn, id, capability, frame, state);
        default:
          conn.send({
            id,
            ok: false,
            error: `unknown kind: ${kind}`,
            code: 'unknown_kind',
          });
      }
    } catch (e) {
      debug('dispatch error: %s', e.stack || e.message);
      conn.send({
        id,
        ok: false,
        error: e.message,
        code: 'internal_error',
      });
    }
  }

  _handleCall(conn, id, name, payload, { clients }) {
    const cap = this.registry.resolve('call', name);
    if (!cap) return this._notExposed(conn, id, 'call', name);
    let client = clients.get(name);
    if (!client) {
      client = this.node.createClient(cap.type, name);
      clients.set(name, client);
    }
    const request = reviveBigInts(payload);
    try {
      client.sendRequest(request, (response) => {
        conn.send({ id, ok: true, payload: toJSONSafe(response) });
      });
    } catch (e) {
      conn.send({
        id,
        ok: false,
        error: `call failed: ${e.message}`,
        code: 'call_failed',
      });
    }
  }

  _handlePublish(conn, id, name, payload, { publishers }) {
    const cap = this.registry.resolve('publish', name);
    if (!cap) return this._notExposed(conn, id, 'publish', name);
    let pub = publishers.get(name);
    if (!pub) {
      pub = this.node.createPublisher(cap.type, name);
      publishers.set(name, pub);
    }
    try {
      pub.publish(reviveBigInts(payload));
      conn.send({ id, ok: true });
    } catch (e) {
      conn.send({
        id,
        ok: false,
        error: `publish failed: ${e.message}`,
        code: 'publish_failed',
      });
    }
  }

  _handleSubscribe(conn, id, name, { subscriptions }) {
    const cap = this.registry.resolve('subscribe', name);
    if (!cap) return this._notExposed(conn, id, 'subscribe', name);
    if (id === undefined || id === null) {
      conn.send({
        ok: false,
        error: 'subscribe requires an id',
        code: 'missing_id',
      });
      return;
    }
    if (subscriptions.has(id)) {
      conn.send({
        id,
        ok: false,
        error: `id already in use: ${id}`,
        code: 'duplicate_id',
      });
      return;
    }
    const subscription = this.node.createSubscription(cap.type, name, (msg) => {
      conn.send({ event: 'message', subId: id, payload: toJSONSafe(msg) });
    });
    subscriptions.set(id, { name, subscription });
    conn.send({ id, ok: true });
  }

  _handleUnsubscribe(conn, id, subId, { subscriptions }) {
    if (subId === undefined || subId === null) {
      conn.send({
        id,
        ok: false,
        error: 'unsubscribe requires subId',
        code: 'missing_sub_id',
      });
      return;
    }
    const entry = subscriptions.get(subId);
    if (!entry) {
      conn.send({
        id,
        ok: false,
        error: `unknown subId: ${subId}`,
        code: 'unknown_sub_id',
      });
      return;
    }
    try {
      this.node.destroySubscription(entry.subscription);
    } catch {
      /* destroy is best-effort */
    }
    subscriptions.delete(subId);
    conn.send({ id, ok: true });
  }

  _notExposed(conn, id, kind, name) {
    conn.send({
      id,
      ok: false,
      error: `capability not exposed: ${kind} ${name}`,
      code: 'not_exposed',
    });
  }

  _handleAction(conn, id, name, frame, state) {
    const op = frame.op;
    if (op === 'send_goal') {
      return this._handleActionSendGoal(conn, id, name, frame.payload, state);
    }
    if (op === 'cancel') {
      return this._handleActionCancel(conn, id, frame.goalId, state);
    }
    conn.send({
      id,
      ok: false,
      error: `unknown action op: ${op}`,
      code: 'unknown_op',
    });
  }

  _handleActionSendGoal(conn, id, name, payload, state) {
    const { actionClients, pendingGoals, goals } = state;
    const cap = this.registry.resolve('action', name);
    if (!cap) return this._notExposed(conn, id, 'action', name);
    if (id === undefined || id === null) {
      conn.send({
        ok: false,
        error: 'action send_goal requires an id',
        code: 'missing_id',
      });
      return;
    }
    if (pendingGoals.has(id) || goals.has(id)) {
      conn.send({
        id,
        ok: false,
        error: `id already in use: ${id}`,
        code: 'duplicate_id',
      });
      return;
    }
    let actionClient = actionClients.get(name);
    if (!actionClient) {
      actionClient = new ActionClient(this.node, cap.type, name);
      actionClients.set(name, actionClient);
    }
    if (!actionClient.isActionServerAvailable()) {
      conn.send({
        id,
        ok: false,
        error: `action server unavailable: ${name}`,
        code: 'action_unavailable',
      });
      return;
    }
    const goal = reviveBigInts(payload);
    const actionGoal = {
      id,
      name,
      actionClient,
      goalUuid: ActionUuid.randomMessage(),
      goalHandle: null,
      finished: false,
    };
    const feedbackCallback = (feedback) => {
      if (actionGoal.finished || state.closed) return;
      conn.send({
        event: 'feedback',
        goalId: id,
        payload: toJSONSafe(feedback),
      });
    };
    const onError = (error) =>
      this._finishActionGoal(conn, state, actionGoal, {
        id,
        ok: false,
        error: `send_goal failed: ${error.message}`,
        code: 'action_failed',
      });
    pendingGoals.set(id, name);
    try {
      actionClient
        .sendGoal(goal, feedbackCallback, actionGoal.goalUuid)
        .then(
          (handle) =>
            this._handleActionGoalResponse(conn, state, actionGoal, handle),
          onError
        );
    } catch (error) {
      onError(error);
    }
  }

  _handleActionGoalResponse(conn, state, actionGoal, handle) {
    const { id, actionClient } = actionGoal;
    state.pendingGoals.delete(id);
    if (state.expired || actionClient.isDestroyed()) {
      this._finishActionGoal(conn, state, actionGoal);
      return;
    }
    actionGoal.goalHandle = handle;
    if (!handle.isAccepted()) {
      this._finishActionGoal(conn, state, actionGoal, {
        id,
        ok: false,
        error: 'goal rejected',
        code: 'goal_rejected',
      });
      return;
    }
    state.goals.set(id, actionGoal);
    conn.send({ id, ok: true, payload: { accepted: true } });
    return this._watchActionResult(conn, state, actionGoal);
  }

  async _watchActionResult(conn, state, actionGoal) {
    const { id, goalHandle } = actionGoal;
    let response;
    try {
      const result = await goalHandle.getResult();
      response = {
        payload: toJSONSafe(result),
        status: _goalStatusName(goalHandle.status),
      };
    } catch (error) {
      response = {
        ok: false,
        error: `get result failed: ${error.message}`,
        code: 'action_failed',
      };
    }
    this._finishActionGoal(conn, state, actionGoal, {
      event: 'result',
      goalId: id,
      ...response,
    });
  }

  _finishActionGoal(conn, state, actionGoal, response) {
    if (actionGoal.finished) return;
    actionGoal.finished = true;
    const { id, name, actionClient, goalUuid } = actionGoal;
    actionClient._removeFeedbackCallback(goalUuid);
    state.pendingGoals.delete(id);
    state.goals.delete(id);
    try {
      if (response) conn.send(response);
    } finally {
      _releaseActionClientIfIdle(state, name);
    }
  }

  _handleActionCancel(conn, id, goalId, state) {
    const { goals, pendingCancels } = state;
    if (goalId === undefined || goalId === null) {
      conn.send({
        id,
        ok: false,
        error: 'action cancel requires goalId',
        code: 'missing_goal_id',
      });
      return;
    }
    const entry = goals.get(goalId);
    if (!entry) {
      conn.send({
        id,
        ok: false,
        error: `unknown goal: ${goalId}`,
        code: 'unknown_goal_id',
      });
      return;
    }
    const token = Symbol('cancel');
    pendingCancels.set(token, entry.name);
    let cancelGoal;
    try {
      cancelGoal = entry.goalHandle.cancelGoal();
    } catch (e) {
      pendingCancels.delete(token);
      conn.send({
        id,
        ok: false,
        error: `cancel failed: ${e.message}`,
        code: 'action_failed',
      });
      _releaseActionClientIfIdle(state, entry.name);
      return;
    }
    cancelGoal.then(
      (response) => {
        pendingCancels.delete(token);
        if (!response.goals_canceling?.length) {
          conn.send({
            id,
            ok: false,
            error: `cancel rejected: ${goalId}`,
            code: 'cancel_rejected',
            payload: toJSONSafe(response),
          });
        } else {
          conn.send({ id, ok: true, payload: toJSONSafe(response) });
        }
        _releaseActionClientIfIdle(state, entry.name);
      },
      (e) => {
        pendingCancels.delete(token);
        conn.send({
          id,
          ok: false,
          error: `cancel failed: ${e.message}`,
          code: 'action_failed',
        });
        _releaseActionClientIfIdle(state, entry.name);
      }
    );
  }
}

function _releaseActionClientIfIdle(state, name) {
  if (!state.closed) return;
  if ([...state.pendingGoals.values()].includes(name)) return;
  if ([...state.pendingCancels.values()].includes(name)) return;
  for (const goal of state.goals.values()) {
    if (goal.name === name) return;
  }
  const actionClient = state.actionClients.get(name);
  if (!actionClient) return;
  state.actionClients.delete(name);
  if (state.actionClients.size === 0) {
    clearTimeout(state.cleanupTimer);
    state.cleanupTimer = null;
  }
  setImmediate(() => {
    try {
      actionClient.destroy();
    } catch {
      /* destroy is best-effort during connection teardown */
    }
  });
}

/** Map a numeric `GoalStatus` constant to the wire's lowercase status name. */
function _goalStatusName(status) {
  switch (status) {
    case ActionInterfaces.GoalStatus.STATUS_SUCCEEDED:
      return 'succeeded';
    case ActionInterfaces.GoalStatus.STATUS_CANCELED:
      return 'canceled';
    case ActionInterfaces.GoalStatus.STATUS_ABORTED:
      return 'aborted';
    default:
      return 'unknown';
  }
}

export { Dispatcher };
