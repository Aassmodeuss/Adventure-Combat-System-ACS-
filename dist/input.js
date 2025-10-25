// @ts-nocheck
/* globals AutoCards, ACS */
/// <reference types="../types/ScriptingTypes.d.ts"/>
// Your "Input" tab should look like this
const modifier = (text) => {
  // Your other input modifier scripts go here (preferred)
  text = AutoCards("input", text);
  text = LocalizedLanguages("input", text);
  // ACS module (event detection & scheduling)
  try { text = ACS("input", text); } catch {}
  // Your other input modifier scripts go here (alternative)
  return { text };
};
modifier(text);
