# Image capture refactor control inventory

This inventory records the destination of the controls that were reachable in the pre-refactor mobile design flow.

| Previous control | New destination | Notes |
| --- | --- | --- |
| Take photo | Choose room photo | Camera permission is requested from this action only. |
| Import from Gallery | Choose room photo → Choose photo | Uses the system picker without required editing. |
| Recent room thumbnails | Choose room photo → Recent room | Three photos per page; unreadable files show an unavailable state. |
| Mandatory photo preview / Retake / Continue | Removed | Capture and import advance directly. Edit photo on Ready offers Replace photo, Crop, or Cancel. |
| Multi / Individual / Replace mode toggle | What would you like to do? | Replaced by the one-time Restyle room, Add a plant, and Replace a plant intent choices. |
| Plant type | Customize → Plants and arrangement → Plant type | All four existing types remain available in pages of up to three. |
| Plant style | Customize → Plants and arrangement → Style | The styles supported by the selected plant type remain available. |
| Plant density | Customize → Plants and arrangement → Density | Sparse, Moderate, and Lush remain available. |
| Pot style | Customize → Pots → Pot style | All five existing values remain available in pages of up to three. |
| Pot color | Customize → Pots → Pot color | All six existing values remain available in pages of up to three. |
| Use planter boxes | Customize → Pots → Planter boxes | Retained as an explicit yes/no setting. |
| Care level | Customize → Preferences → Care level | Low, Medium, and High remain available for Restyle. |
| Plant search | Choose a plant → Browse | Visible text search is retained. |
| Voice search | Choose a plant → Browse | Microphone permission is requested only when voice search is used. |
| Pet-safe only | Choose a plant → Browse / My plants | Retained as catalog filtering and labeled as information rather than a guarantee. |
| Plant grid/list display toggle | Removed | The new catalog has one consistent three-result page; this was a presentation preference, not generation data. |
| Plant size | Automatic default; Customize → Plant and placement → Size | Medium is chosen when supported, otherwise Small then Large by explicit priority. Every supported size remains selectable. |
| Automatic placement | Add Ready | It is the default Add behavior and can be restored by confirming automatic placement. |
| Manual placement | Add Ready → Choose a spot | Confirmation returns to Ready and does not generate. |
| Replacement target | Replace → Mark the plant you want to replace | A valid target is required before plant selection; automatic target selection was removed. |
| Preview submission buttons | Ready → Generate design | Submission now has one consistent label and duplicate-tap guard. |
| Custom prompt | Customize → Preferences → Special instructions | Optional text is preserved in the draft and request adapter. |

The removed `PlantSelectionScreen`, `PlantModeToggle`, and `IndividualPlantSelector` were no longer referenced after the focused routes were connected.
