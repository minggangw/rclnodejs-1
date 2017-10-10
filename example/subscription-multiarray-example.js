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

const rclnodejs = require('../index.js');

rclnodejs.init().then(() => {
  let Int32MultiArray = rclnodejs.require('std_msgs').msg.Int32MultiArray;
  let node = rclnodejs.createNode('subscription_example_node');
  let count = 0;

  node.createSubscription(Int32MultiArray, 'Int32MultiArray', (multiArray) => {
    console.log(`Received ${++count} messages:`);
    let dim = multiArray.layout.dim;
    dim.data.forEach(element => {
      console.log('dimension info:')
      console.log('label = ' + element.label);
      console.log('size = ' + element.size);
      console.log('stride = ' + element.stride);
    });
    console.log('data = ' + multiArray.data);
    // console.log('state.header.stamp.sec = ' + state.header.stamp.sec);
    // console.log('state.header.stamp.sec = ' + state.header.stamp.sec);
    // console.log('state.header.stamp.nanosec = ' + state.header.stamp.nanosec);
    // console.log('state.header.frame_id = ' + state.header.frame_id);
    // console.log('state.name = ' + state.name.toString());
    // console.log('state.position = ' + state.position.toString());
    // console.log('state.velocity = ' + state.velocity.toString());
    // console.log('state.effort = ' + state.effort.toString() + '\n');
  });

  rclnodejs.spin(node);
}).catch(e => {
  console.log(e);
});
