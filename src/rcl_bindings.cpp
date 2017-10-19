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

#include "rcl_bindings.hpp"

#include <rcl/error_handling.h>
#include <rcl/node.h>
#include <rcl/rcl.h>
#include <rosidl_generator_c/string_functions.h>
#include <string>

#include "handle_manager.hpp"
#include "macros.hpp"
#include "rcl_handle.hpp"
#include "rcl_utilities.hpp"
#include "shadow_node.hpp"

namespace rclnodejs {

const rmw_qos_profile_t* GetQoSProfile(v8::Local<v8::Value> qos);

NAN_METHOD(Init) {
  THROW_ERROR_IF_NOT_EQUAL(RCL_RET_OK,
                           rcl_init(0, nullptr, rcl_get_default_allocator()),
                           rcl_get_error_string_safe());
}

NAN_METHOD(CreateNode) {
  std::string node_name(*v8::String::Utf8Value(info[0]));
  std::string name_space(*v8::String::Utf8Value(info[1]));

  rcl_node_t* node = reinterpret_cast<rcl_node_t*>(malloc(sizeof(rcl_node_t)));

  *node = rcl_get_zero_initialized_node();
  rcl_node_options_t options = rcl_node_get_default_options();

  THROW_ERROR_IF_NOT_EQUAL(
      RCL_RET_OK,
      rcl_node_init(node, node_name.c_str(), name_space.c_str(), &options),
      rcl_get_error_string_safe());

  auto handle = RclHandle::NewInstance(node, nullptr, [node] {
      return rcl_node_fini(node);
  });
  info.GetReturnValue().Set(handle);
}

NAN_METHOD(CreateTimer) {
  int64_t period_ms = info[0]->IntegerValue();
  rcl_timer_t* timer =
      reinterpret_cast<rcl_timer_t*>(malloc(sizeof(rcl_timer_t)));
  *timer = rcl_get_zero_initialized_timer();
  THROW_ERROR_IF_NOT_EQUAL(
      RCL_RET_OK,
      rcl_timer_init(timer, RCL_MS_TO_NS((uint64_t)period_ms), nullptr,
          rcl_get_default_allocator()), rcl_get_error_string_safe());

  auto js_obj = RclHandle::NewInstance(timer, nullptr, [timer] {
      return rcl_timer_fini(timer);
  });
  info.GetReturnValue().Set(js_obj);
}

NAN_METHOD(IsTimerReady) {
  RclHandle* timer_handle = RclHandle::Unwrap<RclHandle>(info[0]->ToObject());
  rcl_timer_t* timer = reinterpret_cast<rcl_timer_t*>(timer_handle->ptr());
  bool is_ready = false;

  THROW_ERROR_IF_NOT_EQUAL(RCL_RET_OK, rcl_timer_is_ready(timer, &is_ready),
                           rcl_get_error_string_safe());

  info.GetReturnValue().Set(Nan::New(is_ready));
}

NAN_METHOD(CallTimer) {
  RclHandle* timer_handle = RclHandle::Unwrap<RclHandle>(info[0]->ToObject());
  rcl_timer_t* timer = reinterpret_cast<rcl_timer_t*>(timer_handle->ptr());

  THROW_ERROR_IF_NOT_EQUAL(RCL_RET_OK, rcl_timer_call(timer),
                           rcl_get_error_string_safe());
}

NAN_METHOD(CancelTimer) {
  RclHandle* timer_handle = RclHandle::Unwrap<RclHandle>(info[0]->ToObject());
  rcl_timer_t* timer = reinterpret_cast<rcl_timer_t*>(timer_handle->ptr());

  THROW_ERROR_IF_NOT_EQUAL(RCL_RET_OK, rcl_timer_cancel(timer),
                           rcl_get_error_string_safe());
}

NAN_METHOD(IsTimerCanceled) {
  RclHandle* timer_handle = RclHandle::Unwrap<RclHandle>(info[0]->ToObject());
  rcl_timer_t* timer = reinterpret_cast<rcl_timer_t*>(timer_handle->ptr());
  bool is_canceled = false;

  THROW_ERROR_IF_NOT_EQUAL(RCL_RET_OK,
                           rcl_timer_is_canceled(timer, &is_canceled),
                           rcl_get_error_string_safe());

  info.GetReturnValue().Set(Nan::New(is_canceled));
}

NAN_METHOD(ResetTimer) {
  RclHandle* timer_handle = RclHandle::Unwrap<RclHandle>(info[0]->ToObject());
  rcl_timer_t* timer = reinterpret_cast<rcl_timer_t*>(timer_handle->ptr());

  THROW_ERROR_IF_NOT_EQUAL(RCL_RET_OK, rcl_timer_reset(timer),
                           rcl_get_error_string_safe());
}

NAN_METHOD(TimerGetTimeUntilNextCall) {
  RclHandle* timer_handle = RclHandle::Unwrap<RclHandle>(info[0]->ToObject());
  rcl_timer_t* timer = reinterpret_cast<rcl_timer_t*>(timer_handle->ptr());
  int64_t remaining_time = 0;

  THROW_ERROR_IF_NOT_EQUAL(
      RCL_RET_OK, rcl_timer_get_time_until_next_call(timer, &remaining_time),
      rcl_get_error_string_safe());

  info.GetReturnValue().Set(Nan::New<v8::String>(
      std::to_string(RCL_NS_TO_MS(remaining_time))).ToLocalChecked());
}

NAN_METHOD(TimerGetTimeSinceLastCall) {
  RclHandle* timer_handle = RclHandle::Unwrap<RclHandle>(info[0]->ToObject());
  rcl_timer_t* timer = reinterpret_cast<rcl_timer_t*>(timer_handle->ptr());
  uint64_t elapsed_time = 0;

  THROW_ERROR_IF_NOT_EQUAL(
      RCL_RET_OK, rcl_timer_get_time_since_last_call(timer, &elapsed_time),
      rcl_get_error_string_safe());

  info.GetReturnValue().Set(Nan::New<v8::String>(
    std::to_string(RCL_NS_TO_MS(elapsed_time))).ToLocalChecked());
}

NAN_METHOD(RclTake) {
  RclHandle* subscription_handle =
      RclHandle::Unwrap<RclHandle>(info[0]->ToObject());
  rcl_subscription_t* subscription =
      reinterpret_cast<rcl_subscription_t*>(subscription_handle->ptr());
  void* msg_taken = node::Buffer::Data(info[1]->ToObject());

  rcl_ret_t ret = rcl_take(subscription, msg_taken, nullptr);

  if (ret != RCL_RET_OK && ret != RCL_RET_SUBSCRIPTION_TAKE_FAILED) {
    Nan::ThrowError(rcl_get_error_string_safe());
    rcl_reset_error();
    info.GetReturnValue().Set(Nan::False());
    return;
  }

  if (ret != RCL_RET_SUBSCRIPTION_TAKE_FAILED) {
    info.GetReturnValue().Set(Nan::True());
    return;
  }
  info.GetReturnValue().Set(Nan::Undefined());
}

NAN_METHOD(CreateSubscription) {
  RclHandle* node_handle = RclHandle::Unwrap<RclHandle>(info[0]->ToObject());
  rcl_node_t* node = reinterpret_cast<rcl_node_t*>(node_handle->ptr());
  std::string package_name(*Nan::Utf8String(info[1]->ToString()));
  std::string message_sub_folder(*Nan::Utf8String(info[2]->ToString()));
  std::string message_name(*Nan::Utf8String(info[3]->ToString()));
  std::string topic(*Nan::Utf8String(info[4]->ToString()));

  rcl_subscription_t* subscription =
      reinterpret_cast<rcl_subscription_t*>(malloc(sizeof(rcl_subscription_t)));
  *subscription = rcl_get_zero_initialized_subscription();

  rcl_subscription_options_t subscription_ops =
      rcl_subscription_get_default_options();
  const rmw_qos_profile_t* qos_profile = GetQoSProfile(info[5]);
  if (qos_profile) {
    subscription_ops.qos = *qos_profile;
  }

  const rosidl_message_type_support_t* ts =
      GetMessageTypeSupport(package_name, message_sub_folder, message_name);

  THROW_ERROR_IF_NOT_EQUAL(
      RCL_RET_OK,
      rcl_subscription_init(subscription, node, ts, topic.c_str(),
                            &subscription_ops),
      rcl_get_error_string_safe());

  auto js_obj =
      RclHandle::NewInstance(subscription, node_handle, [subscription, node] {
          return rcl_subscription_fini(subscription, node);
      });
  info.GetReturnValue().Set(js_obj);
}

NAN_METHOD(CreatePublisher) {
  // Extract arguments
  RclHandle* node_handle = RclHandle::Unwrap<RclHandle>(info[0]->ToObject());
  rcl_node_t* node = reinterpret_cast<rcl_node_t*>(node_handle->ptr());
  std::string package_name(*Nan::Utf8String(info[1]->ToString()));
  std::string message_sub_folder(*Nan::Utf8String(info[2]->ToString()));
  std::string message_name(*Nan::Utf8String(info[3]->ToString()));
  std::string topic(*Nan::Utf8String(info[4]->ToString()));

  // Prepare publisher object
  rcl_publisher_t* publisher =
      reinterpret_cast<rcl_publisher_t*>(malloc(sizeof(rcl_publisher_t)));
  *publisher = rcl_get_zero_initialized_publisher();

  // Get type support object dynamically
  const rosidl_message_type_support_t* ts =
      GetMessageTypeSupport(package_name, message_sub_folder, message_name);

  // Using default options
  rcl_publisher_options_t publisher_ops = rcl_publisher_get_default_options();
  const rmw_qos_profile_t* qos_profile = GetQoSProfile(info[5]);
  if (qos_profile) {
    publisher_ops.qos = *qos_profile;
  }

  // Initialize the publisher
  THROW_ERROR_IF_NOT_EQUAL(
      rcl_publisher_init(publisher, node, ts, topic.c_str(), &publisher_ops),
      RCL_RET_OK, rcl_get_error_string_safe());

  // Wrap the handle into JS object
  auto js_obj =
      RclHandle::NewInstance(publisher,
                             node_handle,
                             [publisher, node]() {
          return rcl_publisher_fini(publisher, node);
      });

  // Everything is done
  info.GetReturnValue().Set(js_obj);
}

NAN_METHOD(Publish) {
  rcl_publisher_t* publisher = reinterpret_cast<rcl_publisher_t*>(
      RclHandle::Unwrap<RclHandle>(info[0]->ToObject())->ptr());

  void* buffer = node::Buffer::Data(info[1]->ToObject());
  THROW_ERROR_IF_NOT_EQUAL(rcl_publish(publisher, buffer), RCL_RET_OK,
                           rcl_get_error_string_safe());

  info.GetReturnValue().Set(Nan::Undefined());
}

NAN_METHOD(CreateClient) {
  RclHandle* node_handle = RclHandle::Unwrap<RclHandle>(info[0]->ToObject());
  rcl_node_t* node = reinterpret_cast<rcl_node_t*>(node_handle->ptr());
  std::string service_name(*Nan::Utf8String(info[1]->ToString()));
  std::string interface_name(*Nan::Utf8String(info[2]->ToString()));
  std::string package_name(*Nan::Utf8String(info[3]->ToString()));

  const rosidl_service_type_support_t* ts =
    GetServiceTypeSupport(package_name, interface_name);
  rcl_client_t* client =
      reinterpret_cast<rcl_client_t*>(malloc(sizeof(rcl_client_t)));
  *client = rcl_get_zero_initialized_client();
  rcl_client_options_t client_ops = rcl_client_get_default_options();
  const rmw_qos_profile_t* qos_profile = GetQoSProfile(info[4]);
  if (qos_profile) {
    client_ops.qos = *qos_profile;
  }

  THROW_ERROR_IF_NOT_EQUAL(
      rcl_client_init(client, node, ts, service_name.c_str(), &client_ops),
      RCL_RET_OK, rcl_get_error_string_safe());

  auto js_obj =
      RclHandle::NewInstance(client, node_handle, [client, node] {
          return rcl_client_fini(client, node);
      });

  info.GetReturnValue().Set(js_obj);
}

NAN_METHOD(SendRequest) {
  rcl_client_t* client = reinterpret_cast<rcl_client_t*>(
      RclHandle::Unwrap<RclHandle>(info[0]->ToObject())->ptr());
  void* buffer = node::Buffer::Data(info[1]->ToObject());
  int64_t sequence_number;

  THROW_ERROR_IF_NOT_EQUAL(
      rcl_send_request(client, buffer, &sequence_number),
      RCL_RET_OK, rcl_get_error_string_safe());

  info.GetReturnValue().Set(Nan::New((uint32_t)sequence_number));
}

NAN_METHOD(RclTakeResponse) {
  rcl_client_t* client = reinterpret_cast<rcl_client_t*>(
      RclHandle::Unwrap<RclHandle>(info[0]->ToObject())->ptr());
  int64_t sequence_number = info[1]->IntegerValue();

  rmw_request_id_t * header =
      reinterpret_cast<rmw_request_id_t*>(malloc(sizeof(rmw_request_id_t)));
  header->sequence_number = sequence_number;

  void* taken_response = node::Buffer::Data(info[2]->ToObject());
  rcl_ret_t ret = rcl_take_response(client, header, taken_response);

  if (ret != RCL_RET_CLIENT_TAKE_FAILED) {
    info.GetReturnValue().Set(Nan::True());
    return;
  }

  info.GetReturnValue().Set(Nan::False());
}

NAN_METHOD(CreateService) {
  RclHandle* node_handle = RclHandle::Unwrap<RclHandle>(info[0]->ToObject());
  rcl_node_t* node = reinterpret_cast<rcl_node_t*>(node_handle->ptr());
  std::string service_name(*Nan::Utf8String(info[1]->ToString()));
  std::string interface_name(*Nan::Utf8String(info[2]->ToString()));
  std::string package_name(*Nan::Utf8String(info[3]->ToString()));

  const rosidl_service_type_support_t* ts =
    GetServiceTypeSupport(package_name, interface_name);
  rcl_service_t* service =
      reinterpret_cast<rcl_service_t*>(malloc(sizeof(rcl_service_t)));
  *service = rcl_get_zero_initialized_service();
  rcl_service_options_t service_ops = rcl_service_get_default_options();
  const rmw_qos_profile_t* qos_profile = GetQoSProfile(info[4]);
  if (qos_profile) {
    service_ops.qos = *qos_profile;
  }

  THROW_ERROR_IF_NOT_EQUAL(
      rcl_service_init(service, node, ts, service_name.c_str(), &service_ops),
      RCL_RET_OK, rcl_get_error_string_safe());
  auto js_obj =
      RclHandle::NewInstance(service, node_handle, [service, node] {
          return rcl_service_fini(service, node);
      });

  info.GetReturnValue().Set(js_obj);
}

NAN_METHOD(RclTakeRequest) {
  rcl_service_t* service = reinterpret_cast<rcl_service_t*>(
      RclHandle::Unwrap<RclHandle>(info[0]->ToObject())->ptr());
  rmw_request_id_t* header =
      reinterpret_cast<rmw_request_id_t*>(malloc(sizeof(rmw_request_id_t)));

  void* taken_request = node::Buffer::Data(info[2]->ToObject());
  rcl_ret_t ret = rcl_take_request(service, header, taken_request);
  if (ret != RCL_RET_SERVICE_TAKE_FAILED) {
    auto js_obj = RclHandle::NewInstance(header);
    info.GetReturnValue().Set(js_obj);
    return;
  }

  info.GetReturnValue().Set(Nan::Undefined());
}

NAN_METHOD(SendResponse) {
  rcl_service_t* service = reinterpret_cast<rcl_service_t*>(
      RclHandle::Unwrap<RclHandle>(info[0]->ToObject())->ptr());
  void* buffer = node::Buffer::Data(info[1]->ToObject());

  rmw_request_id_t* header = reinterpret_cast<rmw_request_id_t*>(
      RclHandle::Unwrap<RclHandle>(info[2]->ToObject())->ptr());

  THROW_ERROR_IF_NOT_EQUAL(
      rcl_send_response(service, header, buffer),
      RCL_RET_OK, rcl_get_error_string_safe());
}

const rmw_qos_profile_t* GetQoSProfileFromString(
    const std::string& profile) {
  const rmw_qos_profile_t* qos_profile = nullptr;
  if (profile == "qos_profile_sensor_data") {
    qos_profile = &rmw_qos_profile_sensor_data;
  } else if (profile == "qos_profile_default") {
    qos_profile = &rmw_qos_profile_default;
  } else if (profile == "qos_profile_system_default") {
    qos_profile = &rmw_qos_profile_system_default;
  } else if (profile == "qos_profile_services_default") {
    qos_profile = &rmw_qos_profile_services_default;
  } else if (profile == "qos_profile_parameters") {
    qos_profile = &rmw_qos_profile_parameters;
  } else if (profile == "qos_profile_parameter_events") {
    qos_profile = &rmw_qos_profile_parameter_events;
  } else {
    return nullptr;
  }

  return qos_profile;
}

const rmw_qos_profile_t* GetQosProfileFromObject(v8::Local<v8::Object> object) {
  rmw_qos_profile_t * qos_profile = reinterpret_cast<rmw_qos_profile_t*>(
      malloc(sizeof(rmw_qos_profile_t)));
  qos_profile->history = static_cast<rmw_qos_history_policy_t>(
      object->Get(Nan::New("history").ToLocalChecked())->Uint32Value());
  qos_profile->depth =
      object->Get(Nan::New("depth").ToLocalChecked())->Uint32Value();
  qos_profile->reliability = static_cast<rmw_qos_reliability_policy_t>(
      object->Get(Nan::New("reliability").ToLocalChecked())->Uint32Value());
  qos_profile->durability = static_cast<rmw_qos_durability_policy_t>(
      object->Get(Nan::New("durability").ToLocalChecked())->Uint32Value());
  qos_profile->avoid_ros_namespace_conventions =
      object->Get(Nan::New("avoidRosNameSpaceConventions").ToLocalChecked())
          ->BooleanValue();

  return qos_profile;
}

const rmw_qos_profile_t* GetQoSProfile(v8::Local<v8::Value> qos) {
  if (qos->IsString()) {
    return GetQoSProfileFromString(
        std::string(*Nan::Utf8String(qos->ToString())));
  } else if (qos->IsObject()) {
    return GetQosProfileFromObject(qos->ToObject());
  } else {
    return nullptr;
  }
}

NAN_METHOD(Shutdown) {
  THROW_ERROR_IF_NOT_EQUAL(rcl_shutdown(), RCL_RET_OK,
                           rcl_get_error_string_safe());
  info.GetReturnValue().Set(Nan::Undefined());
}

NAN_METHOD(ROSIDLStringInit) {
    void* buffer = node::Buffer::Data(info[0]->ToObject());
    rosidl_generator_c__String* ptr =
        reinterpret_cast<rosidl_generator_c__String*>(buffer);
  
    rosidl_generator_c__String__init(ptr);
    info.GetReturnValue().Set(Nan::Undefined());
}

uint32_t GetBindingMethodsCount(BindingMethod* methods) {
  uint32_t count = 0;
  while (methods[count].function) {
    count++;
  }
  return count;
}

BindingMethod binding_methods[] = {
    {"init", Init},
    {"createNode", CreateNode},
    {"createTimer", CreateTimer},
    {"isTimerReady", IsTimerReady},
    {"callTimer", CallTimer},
    {"cancelTimer", CancelTimer},
    {"isTimerCanceled", IsTimerCanceled},
    {"resetTimer", ResetTimer},
    {"timerGetTimeSinceLastCall", TimerGetTimeSinceLastCall},
    {"timerGetTimeUntilNextCall", TimerGetTimeUntilNextCall},
    {"rclTake", RclTake},
    {"createSubscription", CreateSubscription},
    {"createPublisher", CreatePublisher},
    {"publish", Publish},
    {"createClient", CreateClient},
    {"rclTakeResponse", RclTakeResponse},
    {"sendRequest", SendRequest},
    {"createService", CreateService},
    {"rclTakeRequest", RclTakeRequest},
    {"sendResponse", SendResponse},
    {"shutdown", Shutdown},
    {"rosIDLStringInit", ROSIDLStringInit},
    {"", nullptr}};

}  // namespace rclnodejs
