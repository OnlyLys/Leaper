# Guide for Contributors

## Building the Extension

Steps:

1. Make sure `npm` has been installed on your system.
2. Clone the project repository.
3. From the command line, run `npm install` in the project directory.

## Running the Extension

Steps:

1. [Build](#Building-the-Extension) the extension.
2. Open the project directory in vscode.
3. Open the "Run and Debug" panel.
4. Select and run `Development Build`.

If you wish to run the release build of this extension, which contains bundled
and minified code, select and run `Release Build` instead. Debugging with the 
release build is not recommended as it does not contain sourcemaps.

## Testing the Extension

Steps:

1. [Build](#Building-the-Extension) the extension.
2. Open the project directory in vscode.
3. Open the "Run and Debug" panel.
4. Select and run `Tests`.

Alternatively, instead of performing steps 2 to 4, the tests can be run from the 
command line by calling `npm test` in the project directory. 

Note that when the tests are running, a secondary vscode window will open. **Do 
not use the mouse or change focus to another window while the secondary window 
is still open**, as that will interrupt the tests. The secondary window will 
automatically close once the tests are completed.

## Manually Installing the Extension into Your Vscode

If desired, the extension can also be manually installed into your vscode. Once 
installed, the extension will be available in all your vscode instances just 
like any other extension, except that it will not be automatically updated since 
it was not installed through the vscode marketplace.

To manually install this extension, perform these steps:

1. [Build](#Building-the-Extension) the extension.
2. Move the entire project directory containing the built extension into
   vscode's [extensions directory](https://code.visualstudio.com/docs/editor/extension-marketplace#_where-are-extensions-installed).

## Contributing to the Repository

Either open an issue or make a pull request on the GitHub repository.
