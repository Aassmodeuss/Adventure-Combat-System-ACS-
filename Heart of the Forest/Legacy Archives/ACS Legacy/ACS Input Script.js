// ACS Input Script

/// <reference types="C:\Users\Braden\Documents\AI Scenarios\Scripting\Adventure Combat System\Types/ScriptingTypes.d.ts"/>

log(info.actionCount); // Hover over to test

const modifier = (text) => { 
  text = onInput_ACS(text);

  return { text }
}//end of modifier

// Don't modify this part
modifier(text)
