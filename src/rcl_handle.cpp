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

#include "rcl_handle.hpp"

namespace rclnodejs {

Nan::Persistent<v8::Function> RclHandle::constructor;

RclHandle::RclHandle() : pointer_(nullptr), type_(RclHandleType_None) {
}

RclHandle::~RclHandle() {
  DestroyMe();
}

void RclHandle::DestroyMe() {
  if (pointer_) {
    switch (type_) {
    case RclHandleType_None:
      break;
    case RclHandleType_ROSNode:
      break;
    case RclHandleType_ROSPublisher:
      break;
    case RclHandleType_ROSSubscription:
      break;
    case RclHandleType_ROSService:
      break;
    case RclHandleType_ROSClient:
      break;
    case RclHandleType_ROSIDLString:
      break;
    case RclHandleType_Malloc:
      free(pointer_);
      break;
    case RclHandleType_Count:  // No need to do anything
      break;
    }
  }
  pointer_ = nullptr;
  type_ = RclHandleType_None;
}

void RclHandle::Init(v8::Local<v8::Object> exports) {
  v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New);
  tpl->SetClassName(Nan::New("RclHandle").ToLocalChecked());
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  constructor.Reset(tpl->GetFunction());
  exports->Set(Nan::New("RclHandle").ToLocalChecked(), tpl->GetFunction());

  Nan::SetPrototypeMethod(tpl, "destroy", Destroy);
}

void RclHandle::New(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  if (info.IsConstructCall()) {
    RclHandle* obj = new RclHandle();
    obj->Wrap(info.This());
    info.GetReturnValue().Set(info.This());
  }
}

NAN_METHOD(RclHandle::Destroy) {
  auto me = Nan::ObjectWrap::Unwrap<RclHandle>(info.This());
  if (me) {
    me->DestroyMe();
  }
  info.GetReturnValue().Set(Nan::Undefined());
}

v8::Local<v8::Object> RclHandle::NewInstance(void* handle,
    RclHandleType type) {
  Nan::EscapableHandleScope scope;

  v8::Local<v8::Function> cons = Nan::New<v8::Function>(constructor);
  v8::Local<v8::Context> context =
      v8::Isolate::GetCurrent()->GetCurrentContext();

  v8::Local<v8::Object> instance =
      cons->NewInstance(context, 0, nullptr).ToLocalChecked();

  auto wrapper = Nan::ObjectWrap::Unwrap<RclHandle>(instance);
  wrapper->SetPtr(handle);
  wrapper->SetType(type);

  return scope.Escape(instance);
}

}  // namespace rclnodejs
