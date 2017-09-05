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

// Usage: lanuch ./install/bin/examples_rclcpp_minimal_subscriber_lambda
// to display the message published by this program

'use strict';

const rclnodejs = require('../index.js');

let JointState = rclnodejs.require('sensor_msgs').msg.JointState;

rclnodejs.init().then(() => {
  let node = rclnodejs.createNode('subscription_example_node');

  /* eslint-disable */
  let String = rclnodejs.require('std_msgs').msg.String;
  let StringArray = rclnodejs.require('std_msgs').msg.StringArray;

  node.createSubscription(JointState, 'topic', (msg) => {
    // console.log(`Receive message: ${msg.data}`);
    // console.log('size = ' + msg.hello.size);
    // console.log('capacity = ' + msg.hello.capacity);
    // for (let i = 0; i < msg.hello.size; i++) {
    //   console.log('element ' + i + ' = ' + msg.hello.data[i].data.data);
    // }
    console.log('stamp = ' + msg.header.stamp.sec);
    console.log('stamp = ' + msg.header.stamp.nanosec);
    console.log('frame_id = ' + msg.header.frame_id.data);  
    msg.name.forEach(str => {
      console.log(str.data);
    });
    msg.position.forEach(str => {
      console.log(str.data);
    });
    msg.velocity.forEach(str => {
      console.log(str.data);
    });
    msg.effort.forEach(str => {
      console.log(str.data);
    });
  });
  /* eslint-enable */

  rclnodejs.spin(node);
}).catch(e => {
  console.log(e);
});
