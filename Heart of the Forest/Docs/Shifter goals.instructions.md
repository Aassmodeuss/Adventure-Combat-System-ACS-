---
applyTo: '**'
---

We are creating a shifter class for a game. The shifter class is based on the lore and traits of shifters as described in the provided documents. The shifter class will have a wolf aspect, which includes minor and major forms, as well as specific abilities and traits related to wolves. The shifter will have a spirit bond with the Great Wolf, granting them unique powers and resistances. The class will also include mechanics for managing the shifter's animal instincts and abilities, such as the risk of going into a Blood Frenzy.

The shifter character will begin as a human with the potential to awaken their wolfblood through a binding ritual. As they progress, they will gain access to various forms and abilities, including enhanced senses, natural attacks, and damage resistance and enhanced healing.

Abilities should be implemented in a way that allows for gradual progression, with new powers and improvements becoming available at higher levels. Abilties should feel feral and unpredictable in the early stages, becoming more controlled and refined as the shifter gains experience.

Lore reference (consult when drafting abilities, forms, and descriptions):

- `Docs/Lore/` — Greenwood world canon and magic systems
- `Docs/Lore/The Heart of the Forest Lore.*` — Weave vs Nature, Blight, factions, places
- `Docs/Lore/Nature Magic Style Guide.md` — tone/voice guidance and templates for Nature/Shifter abilities

# Shifter class implementation instructions

1. **Class Structure**: Create a `Shifter` class that includes properties for the shifter's current form, abilities, and spirit bond status.

2. **Forms**: Implement minor and major forms for the shifter, each with unique abilities and traits. Include methods for transforming between forms.

3. **Spirit Bond**: Establish a mechanism for the shifter's bond with the Great Wolf, granting them access to special powers and resistances. This could involve a separate `SpiritBond` class or a set of properties within the `Shifter` class.

4. **Animal Instincts**: Create a system for managing the shifter's animal instincts, including the risk of entering a Blood Frenzy. This could involve a state machine or a set of flags that track the shifter's current mental state.

5. **Progression**: Design the shifter's abilities to unlock and improve as the character levels up. This could involve a skill tree or a set of milestones that grant new powers and enhancements.

6. **Testing**: Implement unit tests to ensure the shifter class behaves as expected, including tests for form transformations, ability activation, and spirit bond effects.
7. **Documentation**: Provide clear documentation for the shifter class, including descriptions of abilities, forms, and progression mechanics. This will help other developers understand how to use and extend the class in the future.

8. **Integration**: Ensure the shifter class integrates smoothly with existing game systems, such as combat, inventory, and character management. This may involve creating interfaces or adapters to connect the shifter class with other parts of the game engine.
