> **Draft for team review — verify before submitting.**
> Written to the event guide's rules on "Super Intelligence" (SI) tools: SI may assist but should not originate the solution idea; describe how it was used; visibly watermark generated images and video; acknowledge generated audio, code and data in descriptive text and metadata; generated content must not use or modify NASA branding. The disclosure field is not shown to judges.
>
> **For the team to check before pasting:**
> - The guide asks for generated code to be acknowledged in **metadata** as well as text. Consider adding a one-line note to the repository README or `game/package.json`, such as "Code written with AI assistance (Anthropic Claude via Claude Code); see ai-disclosure.md."
> - Confirm that no SI tool other than Claude was used (for example, chat assistants, code completion, translation or image tools). If one was, add it under "Tool used".
> - If the demo video or slides use any AI-generated images, video, voice or music, they must be watermarked or acknowledged, and this file updated.

# Rover Engineer: AI Use Disclosure

## Form version (one paragraph)

Rover Engineer is the work of a two-person human team, which originated the game concept and made all key design decisions: a player designs a rover within constraints, it is delivered to another world, and the player keeps it working on the surface, with a mass-versus-cost puzzle, launch "ticket" tiers, a Moon → Mars → Titan progression, research points versus money, and optional history facts. We used Anthropic's Claude, through Claude Code, extensively: for background research and literature summaries on NASA missions and rovers; for drafting and organizing design documents from our decisions; for writing essentially all of the game's code (TypeScript, Three.js, Rapier) and the Python scripts that process NASA data; for balancing numbers; for drafting the in-game text (tutorial, milestone pop-ups, history facts, debrief and credits) and fact-checking the history facts against cited sources; and for drafting these submission texts. Team members directed, reviewed and tested this work. The game contains no AI-generated images, video or audio: its visuals are real NASA data (terrain and imagery) plus procedural rendering. It uses no NASA logos or branding; REL (Rover Exploration Laboratory) is a fictional agency.

## Full disclosure

### Tool used

- **Anthropic Claude**, used through **Claude Code** (Anthropic's command-line coding assistant).

### Who originated the idea

The game concept came from the two human team members, not from SI. The team decided:

- The core loop: the player designs a rover within constraints, it is delivered to another world, and the player keeps it working on the surface.
- The mass-versus-cost puzzle on the design screen.
- The launch "ticket" tiers story: the agency buys the rover a spot on the next launch, and a heavier or bigger rover needs a pricier tier.
- The Moon → Mars → Titan progression, with longer missions on each world.
- Two currencies: research points, which unlock parts, and money, which buys them.
- Optional real-history facts.
- All key gameplay decisions.

### What SI was used for

Claude was used extensively, in these areas:

| Area | How Claude was used |
| --- | --- |
| Research | Background research and literature summaries on NASA missions and rovers |
| Design documents | Drafting and organizing the design documents from the team's decisions |
| Game code | Writing essentially all of the game's code, in TypeScript with Three.js (3D rendering) and Rapier (physics) |
| Data processing | Writing the Python scripts that turn NASA datasets into game files: the LOLA terrain, slope, sunlight, permanent-shadow and Earth-visibility files, the LROC ground texture, and the DONKI solar flare list |
| Balancing | Balancing game numbers such as part costs, masses, energy use and ticket prices |
| In-game text | Drafting the tutorial, milestone pop-ups, history facts, debrief and credits text, in the tone the team set |
| Fact-checking | Checking the in-game history facts against cited sources |
| Submission | Drafting these submission texts |

### What the team did

The team members made the design decisions, directed the work, reviewed what Claude produced, and tested the game.

### Generated code and data, acknowledged

- **Code:** essentially all of the game's source code (`game/src/`) and the data-processing scripts (`game/tools/`) were written by Claude under the team's direction.
- **Data:** the game's terrain, lighting and texture files (`game/public/terrain/`) and the flare list in `game/data/events.json` are real NASA data, downloaded and processed by those Claude-written scripts. The processing (cropping, resampling, removing baked-in shading, choosing the landing site and feature points from the real maps) is documented in `terrain.json`, `texture.json` and `game/tools/README.md`. Game balance values in `game/data/` were set with Claude's help; the game labels its money amounts as game values, not real costs.

### Generated media

No AI-generated images, video or audio are used in the game. Its visuals are real NASA data (LOLA terrain and LROC imagery) plus procedural rendering: the rover model, the Earth disc, the star field, the boulders and fine ground detail are drawn at run time by the game's code, not taken from image files. Because that code is Claude-written (see above), these procedural visuals are covered by the code acknowledgement. In-game photos are screenshots the player takes of the game view.

### NASA branding

The game uses no NASA logos, insignia or other branding, and SI was not used to create or modify any. The in-game agency, REL (Rover Exploration Laboratory), is fictional. NASA missions and datasets are named only as factual sources, and the credits screen states that the game is not affiliated with or endorsed by NASA.
