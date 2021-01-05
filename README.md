# rclnodejs - ROS2 Client Library for JavaScript [![npm](https://img.shields.io/npm/v/rclnodejs.svg)](https://www.npmjs.com/package/rclnodejs)[![Coverage Status](https://coveralls.io/repos/github/RobotWebTools/rclnodejs/badge.svg?branch=develop)](https://coveralls.io/github/RobotWebTools/rclnodejs?branch=develop)[![npm](https://img.shields.io/npm/dm/rclnodejs)](https://www.npmjs.com/package/rclnodejs)[![GitHub license](https://img.shields.io/github/license/RobotWebTools/rclnodejs.svg)](https://github.com/RobotWebTools/rclnodejs/blob/develop/LICENSE)[![node](https://img.shields.io/node/v/rclnodejs.svg)](https://nodejs.org/en/download/releases/)[![dependencies Status](https://david-dm.org/RobotWebTools/rclnodejs/status.svg)](https://david-dm.org/RobotWebTools/rclnodejs)[![npm type definitions](https://img.shields.io/npm/types/rclnodejs)](https://www.npmjs.com/package/rclnodejs)[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

| Branch  |                                                            Linux Build                                                             |                                                                       macOS Build                                                                       |                                                                                Windows Build                                                                                |
| ------- | :--------------------------------------------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| develop | [![Build Status](https://travis-ci.org/RobotWebTools/rclnodejs.svg?branch=develop)](https://travis-ci.org/RobotWebTools/rclnodejs) | [![macOS Build Status](https://circleci.com/gh/RobotWebTools/rclnodejs/tree/develop.svg?style=shield)](https://circleci.com/gh/RobotWebTools/rclnodejs) | [![Build status](https://ci.appveyor.com/api/projects/status/upbc7tavdag1aa5e/branch/develop?svg=true)](https://ci.appveyor.com/project/minggangw/rclnodejs/branch/develop) |
| master  | [![Build Status](https://travis-ci.org/RobotWebTools/rclnodejs.svg?branch=master)](https://travis-ci.org/RobotWebTools/rclnodejs)  | [![macOS Build Status](https://circleci.com/gh/RobotWebTools/rclnodejs/tree/master.svg?style=shield)](https://circleci.com/gh/RobotWebTools/rclnodejs)  |  [![Build status](https://ci.appveyor.com/api/projects/status/upbc7tavdag1aa5e/branch/master?svg=true)](https://ci.appveyor.com/project/minggangw/rclnodejs/branch/master)  |

`rclnodejs` is a Node.js client library for the Robot Operating System (ROS 2). It provides a JavaScript API and TypeScript declarations for ROS 2 programming.

Here's an example for how to create a ROS 2 node that publishes a string message in a few lines of JavaScript.

```JavaScript
const rclnodejs = require('rclnodejs');
rclnodejs.init().then(() => {
  const node = new rclnodejs.Node('publisher_example_node');
  const publisher = node.createPublisher('std_msgs/msg/String', 'topic');
  publisher.publish(`Hello ROS 2 from rclnodejs`);
  node.spin();
});
```
## Documentation
- [Installation](#installation)
- [API Documentation](#api-documentation)
- [Using TypeScript](#using-typescript)
- [Examples](https://github.com/RobotWebTools/rclnodejs/tree/develop/example)
- [FAQ and Known Issues](./docs/FAQ.md)
- [Building from Scratch](./docs/BUILDING.md)
- [Contributing](#contributing)

## Installation

### Prerequisites
Before installing `rclnodejs` please ensure the following softare is installed and configured on your systemd:

- [Nodejs](https://nodejs.org/en/) version between 8.12 - 12.x.

- [ROS 2 SDK](https://index.ros.org/doc/ros2/Installation/) for details.
**DON'T FORGET TO [SOURCE THE ROS 2 SETUP FILE](https://index.ros.org/doc/ros2/Tutorials/Configuring-ROS2-Environment/#source-the-setup-files)**

### Installing rclnodejs

Install the rclnodejs version that is compatible with your version of ROS 2 (see table below).

For the most current version of rclnodejs run:
```bash
npm i rclnodejs
```

To install a specific version of rclnodejs use:

```bash
npm i rclnodejs@x.y.z
```

|                                                            RCLNODEJS Version                                                            |                                                                         Compatible ROS 2 Release                                                                         |
| :-------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| [0.17.0 (current)](https://www.npmjs.com/package/rclnodejs/v/0.17.0) ([API](http://robotwebtools.org/rclnodejs/docs/0.17.0/index.html)) | [Foxy Fitzroy](https://github.com/ros2/ros2/releases/tag/release-foxy-20201009) / [Eloquent Elusor](https://github.com/ros2/ros2/releases/tag/release-eloquent-20200124) |
|                                [0.10.3](https://github.com/RobotWebTools/rclnodejs/releases/tag/0.10.3)                                 |                                    [Dashing Diademata - Patch 4](https://github.com/ros2/ros2/releases/tag/release-dashing-20191018)                                     |

- **Note:** to install rclnodejs from GitHub: add `"rclnodejs":"RobotWebTools/rclnodejs#<branch>"` to your `package.json` depdendency section.

## API Documentation

API documentation is generated by `jsdoc` and can be viewed in the `docs/` folder or [on-line](http://robotwebtools.org/rclnodejs/docs/index.html). To create a local copy of the documentation run `npm run docs`.

## Using TypeScript

`rclnodejs` API can be used in TypeScript projects. You can find the TypeScript declaration files (\*.d.ts) in the `types/` folder.  

Your project `tsconfig.json` file should include the following compiler options:

```jsonc
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "target": "es6"
    // your additional options here
  }
}
```

Here's a short `rclnodejs` TypeScript example:

```typescript
import * as rclnodejs from 'rclnodejs';
rclnodejs.init().then(() => {
  const node = new rclnodejs.Node('publisher_example_node');
  const publisher = node.createPublisher('std_msgs/msg/String', 'topic');
  publisher.publish(`Hello ROS 2 from rclnodejs`);
  node.spin();
});
```

The benefits of using TypeScript become evident when working with more complex use-cases. The ROS 2 messages in your environment are defined in the `types/interfaces.d.ts` module. This module is updated as part of the `generate-ros-messages` process. Here's a trivial example of working with a String msg.

```typescript
const msg: rclnodejs.std_msgs.msg.String = {
  data: 'hello ROS2 from rclnodejs',
};
```

## Contributing

Please make sure to read the [Contributing Guide]() before making a pull request.

Thank you to all the [people](CONTRIBUTORS.md) who already contributed to rclnodejs!

[![](https://github.com/wayneparrott.png?size=25)](https://github.com/wayneparrott)
[![](https://github.com/minggangw.png?size=25)](https://github.com/minggangw)

## License
This project abides by the [Apache License 2.0](https://github.com/RobotWebTools/rclnodejs/blob/develop/LICENSE).
