// @ts-nocheck
/* globals AutoCards, ACS, stop */
/// <reference types="../types/ScriptingTypes.d.ts"/>
// Your "Context" tab should look like this
const modifier = (text) => {
  // Your other context modifier scripts go here (preferred)
  [text, stop] = AutoCards("context", text, stop);
  text = LocalizedLanguages("context", text);
  // ACS module (persistence & structure maintenance)
  try { [text, stop] = ACS("context", text, stop); } catch {}
  // Your other context modifier scripts go here (risky)
  return { text, stop };
};
modifier(text);
