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
//  to display the message published by this program

'use strict';

const rclnodejs = require('../index.js');

rclnodejs.init().then(() => {
  const node = rclnodejs.createNode('publisher_example_node');

  /* eslint-disable */
  // let JointState = rclnodejs.require('sensor_msgs').msg.JointState;
  // const publisher = node.createPublisher(JointState, 'topic');
  // let msg = new JointState();
  // msg.header.frame_id = 'hello';
  // msg.name = ['aa', 'bb'];
  // msg.position = [1, 1];
  // msg.velocity = [1, 1];
  // msg.effort = [1, 1];
  let String = rclnodejs.require('std_msgs').msg.String;
  let StringArray = rclnodejs.require('std_msgs').msg.StringArray;
  let Int32 = rclnodejs.require('std_msgs').msg.Int32;
  let UInt32 = rclnodejs.require('std_msgs').msg.UInt32;
  let Header = rclnodejs.require('std_msgs').msg.Header;
  let JointState = rclnodejs.require('sensor_msgs').msg.JointState;
  let Time = rclnodejs.require('builtin_interfaces').msg.Time;

  const publisher = node.createPublisher(JointState, 'topic');
  let msg1 = new String();
  let msg2 = new String();
  /* eslint-enable */

  let counter = 0;
  setInterval(function() {
    const str = 'Hello ROS ' + counter++;
    console.log('Publishing message:', str);

    msg1.hello = str;
    msg2.hello = str;
    
    let arr = new StringArray();
    arr.hello = ['very', 'good', 'hello', 'world'];
  
    let state = new JointState();
    let header = new Header();
  
    let time = new Time();
    let m = new Int32();
    m.data = 666;
    let n = new UInt32();
    n.data = 999;
    time.sec = 888;
    time.nanosec = 666;

    let frame_id = new String();
    frame_id.data = '789';

    header.stamp = time;
    header.frame_id = frame_id;    


    state.header = header;
    console.log('============== header.frame_id = ');
    //console.log(state.header.stamp.sec.data);
    console.log('============== header.frame_id = ');
    state.name = ['hello', 'world'];
    state.position = [1.2, 1.2];
    state.velocity = [1.2, 1.2];
    state.effort = [1.2, 1.2];
    // let array = new String.ArrayType(2);
    // array.push(['aaa', 'bbb']);
    // console.log(array.toRawROS());
    publisher.publish(state);
  }, 1000);

  rclnodejs.spin(node);
}).catch(e => {
  console.log(e);
});
