// ACS Output Script

/// <reference types="C:\Users\Braden\Documents\AI Scenarios\Scripting\Adventure Combat System\Types/ScriptingTypes.d.ts"/>

log(info.actionCount); // Hover over to test

// Every script needs a modifier function
const modifier = (text) => {
  text = onOutput_ACS(text);
 
  return { text }
}//end of modifier

// Don't modify this part
modifier(text)
