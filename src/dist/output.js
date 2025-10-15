/// <reference types="../types/ScriptingTypes.d.ts"/>
// Your "Output" tab should look like this
const modifier = (text) => {
  // Your other output modifier scripts go here (preferred)
  text = AutoCards("output", text);
  // ACS module (effects resolution & feedback)
  try { text = ACS("output", text); } catch {}
  // Your other output modifier scripts go here (alternative)
  return { text };
};
modifier(text);
