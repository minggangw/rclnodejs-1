{
  'target_defaults': {
    'default_configuration': 'Release',
    'configurations': {
      'Debug': {
        'defines': ['SPDLOG_DEBUG_ON'],
      },
    }
  },
  'targets': [
    {
      'target_name': 'rclnodejs',
      'variables': {
        'ROS2_INSTALL_PATH': '<!(echo $AMENT_PREFIX_PATH)',
      },
      'sources': [
        './src/addon.cpp',
        './src/executor.cpp',
        './src/handle_manager.cpp',
        './src/rcl_bindings.cpp',
        './src/rcl_handle.cpp',
        './src/rcl_utilities.cpp',
        './src/shadow_node.cpp',
      ],
      'include_dirs': [
        '.',
        'src/third_party/spdlog/include/',
        "<!(node -e \"require('nan')\")",
      ],
      'cflags!': [
        '-fno-exceptions'
      ],
      'cflags': [
        '-fstack-protector-strong',
        '-fPIE -fPIC',
        '-O2 -D_FORTIFY_SOURCE=2',
        '-Wformat -Wformat-security'
      ],
      'cflags_cc!': [
        '-fno-exceptions'
      ],
      'libraries': [
        '-lrcl',
        '-lrcutils',
        '-lrmw',
        '-lrosidl_generator_c',
      ],
      'conditions': [
        [
          'OS=="linux"', {
            'defines': [
              'OS_LINUX'
            ],
            'include_dirs': [
              "<(ROS2_INSTALL_PATH)/include/",
            ],
            'cflags_cc': [
              '-std=c++14'
            ],
            'libraries': [
              '-L<(ROS2_INSTALL_PATH)/lib'
            ],
          }
        ],
        [
          'OS=="win"',
          {
            'defines': [
              'OS_WINDOWS'
            ],
            'variables': {
              "ROS2_INSTALL_PATH_WINDOWS": "<!(echo %AMENT_PREFIX_PATH%)",
            },
            'cflags_cc': [
              '-std=c++14'
            ],
            'include_dirs': [
              './src/third_party/dlfcn-win32/',
              '<(ROS2_INSTALL_PATH_WINDOWS)/include/',
            ],
            'sources': [
              './src/third_party/dlfcn-win32/dlfcn.c',
            ],
            'msvs_settings': {
              'VCCLCompilerTool': {
                'ExceptionHandling': '2', # /EHsc
              },
              'VCLinkerTool': {
                'AdditionalDependencies': ['psapi.lib'],
                'AdditionalLibraryDirectories': ['<(ROS2_INSTALL_PATH_WINDOWS)/lib/'],
              }
            }
          }
        ],
        [
          'OS=="mac"',
          {
            'defines': [
              'OS_MACOS'
            ],
            'include_dirs': [
              "<(ROS2_INSTALL_PATH)/include/",
            ],
            'libraries': [
              '-L<(ROS2_INSTALL_PATH)/lib'
            ],
            'xcode_settings': {
              'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
              'CLANG_CXX_LIBRARY': 'libc++',
              'MACOS_DEPLOYMENT_TARGET': '10.12',
              'CLANG_CXX_LANGUAGE_STANDARD': 'c++14'
            }
          }
        ]
      ]
    }
  ]
}
