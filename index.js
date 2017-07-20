// Copyright (c) 2017 Intel Corporation. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const rclnodejs = require('bindings')('rclnodejs');
const Node = require('./lib/node.js');
const generator = require('./rosidl_gen/generator.js');
const packages = require('./rosidl_gen/packages.js');
const loader = require('./lib/interface_loader.js');

function inherits(target, source) {
  let properties = Object.getOwnPropertyNames(source.prototype);
  properties.forEach((property) => {
    target.prototype[property] = source.prototype[property];
  });
}

inherits(rclnodejs.ShadowNode, Node);

let rcl = {
  _initialized: false,
  _nodes: [],

  createNode(nodeName, namespace = '') {
    if (typeof (nodeName) !== 'string' || typeof (namespace) !== 'string') {
      throw new TypeError('Invalid argument.');
    }

    let handle = rclnodejs.createNode(nodeName, namespace);
    let node =  new rclnodejs.ShadowNode();

    node.init();
    node._handle = handle;
    this._nodes.push(node);
    return node;
  },

  init(...args) {
    return new Promise((resolve, reject) => {
      if (!this._initialized) {
        // TODO(Kenny): introduce other policy to save the amout of time of doing message generation
        generator.generateAll(false).then(() => {
          rclnodejs.init(args);
          this._initialized = true;
          resolve();
        }).catch((e) => {
          reject(e);
        });
      } else {
        console.log('Warning - rclnodejs is already initialized. These arguments will be ignored:', args);
        resolve();
      }
    });
  },

  spin(node) {
    if (!(node instanceof rclnodejs.ShadowNode)) {
      throw new TypeError('Invalid argument.');
    }
    if (node.spinning) {
      throw new Error('The node is already spinning.');
    }

    rclnodejs.spin(node);
    node.spinning = true;
  },

  shutdown() {
    this._nodes.forEach((node) => {
      node.destory();
    });

    rclnodejs.shutdown();
    this._nodes = [];
    this._initialized = false;
  },

  require(packageName, interfaceName) {
    // TODO(minggang): Can require by a single interface name instead of the
    // whole package.
    let interfaceInfos = loader.loadInterfaceInfos(packageName);
    let pkg = {};

    interfaceInfos.forEach((info) => {
      Object.defineProperty(pkg, info.name, {value: require(info.filePath)});
    });
    return pkg;
  },

  regenerateAll() {
    // This will trigger to regererate all the JS structs used for messages and services,
    // to overwrite the existing ones although they have been created.
    return new Promise((resolve, reject) => {
      generator.generateAll(true).then(() => {
        resolve();
      }).catch((e) => {
        reject(e);
      });
    });
  }
};

module.exports = rcl;
