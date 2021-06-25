# Guide for Contributors

## Building the Extension

Steps:

1. Make sure `npm` has been installed on your system.
2. Clone the project repository.
3. From the command line, run `npm install` in the project directory. `npm` 
   will download all the necessary dependencies and compile the code.

## Running the Extension

Steps:

1. Make sure the extension has been [built](#Building-the-Extension).
2. Open the project workspace in vscode.
3. Open the "Run and Debug" panel.
4. Select and run `Development Build`.

If you wish to run the release build of this extension, which contains bundled
and minified code, select `Release Build` during step 4. You do not need to
rebuild the extension for this, as the project has been configured to recompile
the code before each run. 

However, debugging with the release build of this extension is not recommended
since it does not contain sourcemaps.

## Testing the Extension

Steps:

1. Make sure the extension has been [built](#Building-the-Extension).
2. Open the project workspace in vscode.
3. Open the "Run and Debug" panel.
4. Select and run `Tests`.

Alternatively, after the extension has been built, instead of performing steps 
2 to 4, the tests can be run from the command line by calling `npm test` in the 
project directory. 

Note that regardless of how the tests are launched, when the tests are running, 
a secondary vscode window will open. **Do not use the mouse or change focus to 
another window while the secondary window is still open** as that will interrupt 
the tests. The secondary window will close automatically once the tests are
completed.

## Manually Installing the Extension

If desired, the extension can also be manually installed into vscode. Once 
installed, the extension will be available in all vscode instances just like any 
other extension, except that it will not be automatically updated since it was 
not installed through the vscode marketplace.

To manually install this extension, perform these steps:

1. Make sure the extension has been [built](#Building-the-Extension).
2. Move the entire project folder (which contains the built extension) into
   vscode's [extensions folder](https://code.visualstudio.com/docs/editor/extension-marketplace#_where-are-extensions-installed).

By default, a development build is created after step 1. If you wish to generate 
the release build, in between steps 1 and 2, from the command line execute 
`npm run build-release` in the project directory. 

## Contributing to the Repository

Fork the repository on GitHub and make any changes on the fork. After that, make 
a pull request.
