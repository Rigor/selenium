// To debug selenium browse to this URL:
// chrome://selenium-ide/content/selenium-ide.xul

/**
 *
 * Helper functions
 *
 */

Rigor = {};

// our custom commands
Rigor.isPasswordCommandType = function(commandType) {
  return commandType == 'typePassword' || commandType == 'typePasswordAndWait';
}

// toggling Selenium's Command Value field between password and text.
Rigor.updateCommandValueType = function(commandType) {
  var commandValue = document.getElementById('commandValue');

  if (Rigor.isPasswordCommandType(commandType)) {
    commandValue.type = 'password';
  } else {
    commandValue.type = null;
  }
};

// Discover the input field's type given a specific locator
Rigor.locatorFieldType = function(locator) {
  var fieldType = null;

  // most of this is lifted from selenium-runner's showElement
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
  var contentWindow = wm.getMostRecentWindow('navigator:browser').getBrowser().contentWindow;
  var selenium = Selenium.createForWindow(contentWindow);
  locator = selenium.preprocessParameter(locator);

  var pageBot = new MozillaBrowserBot(contentWindow);
  pageBot.getCurrentWindow = function() {
    return contentWindow;
  }

  try {
    var element = pageBot.findElement(locator);

    if (element) {
      fieldType = element.type;
    }
  } catch (error) { // page bot may hate
  }

  return fieldType;
};

/**
 *
 * Injecting Custom functionality
 *
 */

// Toggles the command value field between text/password when selecting a command
// from the list of commands.
//
// Testing steps:
// 1. Create two steps (one type and one typePassword)
// 2. Select the "type" command (value field should be plaintext)
// 3. Select the "typePassword" command (value field should be masked)
(function() {
  var original = TreeView.prototype.updateTextBox;

  var modified = function(id, value, disabled, autoComplete) {
    if (id == 'commandValue' && this.currentCommand) {
      Rigor.updateCommandValueType(this.currentCommand.command);
    }

    return original.call(this, id, value, disabled, autoComplete);
  }

  TreeView.prototype.updateTextBox = modified;
})();

// Toggles the command value field between text/password when the command field is changed
// either by selecting a password command or typing one in.
//
// Testing steps:
// 1. Select any command that contains a value
// 2. Change its command type to "type" (value field should be plaintext)
// 3. Change its command type to "typePassword" (value field should be masked)
(function() {
  var original = TreeView.prototype.updateCurrentCommand;

  var modified = function(key, value) {
    if (key == 'command') {
      Rigor.updateCommandValueType(value);
    }
    return original.call(this, key, value);
  }

  TreeView.prototype.updateCurrentCommand = modified;
})();

// Masks passwords inside the commands list.
//
// Testing steps:
// 1. Create a "typePassword" command with a value.
// 2. The list of commands should mask the password inside the "Value" column.
(function() {
  var original = TreeView.prototype.getCellText;

  var modified = function(row, column) {
    var colId = column.id != null ? column.id : column;
    var command = this.getCommand(row);

    if (command.command == 'typePassword' && colId == 'value') {
      return '**************';
    } else {
      return original.call(this, row, column);
    }
  }

  TreeView.prototype.getCellText = modified;
})();

// Detects when the user types into a password field while recording.
//
// Testing steps:
// 1. Start Recording
// 2. Go to https://my.rigor.com
// 3. Fill in "Email" with a value
// 4. Fill in "Password" with a value
// 5. The command list should contain a "typePassword" step masking your password.
(function() {
  var original = Recorder.prototype.record;

  var modified = function(command, target, value, insertBeforeLastCommand) {
    if (command == 'type' || command == 'typeAndWait') {
      // array of [locator, finderName] via locatorBuilders#buildAll
      var locator = target[0][0];
      var fieldType = Rigor.locatorFieldType(locator);

      if (fieldType == 'password') {
        if (command == 'type') {
          command = 'typePassword';
        } else {
          command = 'typePasswordAndWait';
        }
      }
    }

    original.call(this, command, target, value, insertBeforeLastCommand);
  }

  Recorder.prototype.record = modified;
})();

/**
 *
 * Our custom field type (must be at the end of this file)
 *
 */

Selenium.prototype.doTypePassword = function(locator, password) {
  // just types the password field
  this.doType(locator, password);
}
