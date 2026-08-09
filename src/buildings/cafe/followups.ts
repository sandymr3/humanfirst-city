// The transfer beat — the third question, and the scripted bank it comes from.
//
// PRD §9.6: the beat is generated server-side from both prior choices and asked
// in the host's voice. `POST /api/v1/ai/followup` is backend work that has not
// landed, and the framework's ApiClient is maintainer-owned, so the Café plays
// the fallback bank instead. **That is the designed degraded path, not a stub**
// — §2's assumptions table says in as many words that with the generator absent
// the bank serves every beat and the player cannot tell.
//
// Two rules, and they are the same two the generated version is gated on:
//
//   * **No tiers.** Same as trees.ts. The ranking lives in the server rubric.
//   * **Never comment on the earlier decision.** "The oat milk you rushed in has
//     run out" is a verdict with a timestamp on it. "The oat's moving. The
//     station café opens at seven from Monday" is the same situation with no
//     opinion in it, and it is the one to write (PRD §9.6.5).
//
// Branch-agnostic but world-aware: each may vary its opening clause on one named
// key, which is what lets the same beat land differently in a full room and a
// thin one without knowing what you chose to get there.
import type { CastId } from "./cast";
import type { World, WorldKey, WorldPatch } from "./world";
import { PRO_FOLLOWUPS } from "./followupsPro";

export interface FollowupOption {
  id: string;
  text: string;
  consequence: string;
  world?: WorldPatch;
}

export interface FollowupBeat {
  activityId: string;
  /** Who asks. Resolved against who is actually in the room before it is used. */
  speakerId: CastId | "room";
  /**
   * The one world key this beat's opening clause turns on (PRD §9.6.4). Declared
   * rather than implied so the content test can check that it actually varies —
   * a beat that reads identically in a full room and a thin one is a beat that
   * has stopped being about this café.
   */
  variesOn: WorldKey;
  /** The situation, as a function of the one key this beat varies on. */
  prompt: (world: World) => string;
  options: readonly FollowupOption[];
}

const HARD_FOLLOWUPS: Readonly<Record<string, FollowupBeat>> = {
  // Track A opens on the station café changing its hours, and varies on
  // `regulars` (PRD §9.6.4).
  "C1-SCA-01": {
    activityId: "C1-SCA-01",
    speakerId: "nadia",
    variesOn: "regulars",
    prompt: (world) => {
      const room =
        world.regulars === "thin"
          ? "The room is thinner in the mornings than it was six weeks ago."
          : "The 7:50 window is yours again.";
      return `Six weeks on. ${room} The station café has started opening at seven. Nadia, on her way out: “You going to keep doing this every time they move?”`;
    },
    options: [
      {
        id: "o_c1a",
        text: "Not every time. But I'd rather find out what seven o'clock is actually worth to people before I decide whether to match it.",
        consequence:
          "You spend a week counting who is at the door before eight. It is fourteen people, and eleven of them are the same eleven every day.",
        world: { regulars: "steady" },
      },
      {
        id: "o_c1b",
        text: "We open at seven from Monday. They've moved, so we move — you can't let the place down the road set the hours and keep the crowd.",
        consequence:
          "You open at seven from Monday. The first hour is quiet and the staff cost is not, and by Thursday Priya has stopped asking what the plan is.",
        world: { staff: "strained" },
      },
      {
        id: "o_c1c",
        text: "No. They can have seven o'clock — I'd rather be the place you come to at ten past eight and actually sit down in.",
        consequence:
          "You leave the hours where they are. Two of the early ones go down the road for good, and the four-top fills out later in the morning than it used to.",
        world: { regulars: "steady" },
      },
    ],
  },

  "C2-SCA-01": {
    activityId: "C2-SCA-01",
    speakerId: "priya",
    variesOn: "chalkboard",
    prompt: (world) => {
      const board =
        world.chalkboard === "iced_renamed"
          ? "under the new name"
          : world.chalkboard === "base"
            ? "which isn't on the board any more"
            : "the way it is now";
      return `Somebody came in asking for the iced drink ${board}, and wanted it made how it was in July. Priya: “Do we do the old one for her, or do we not?”`;
    },
    options: [
      {
        id: "o_c2a",
        text: "Make hers how she wants it and leave the board alone. One person's habit isn't a reason to reopen something we already tested.",
        consequence:
          "Priya makes it the old way without comment. It happens about twice a week after that, quietly, and never gets written down anywhere.",
      },
      {
        id: "o_c2b",
        text: "Ask her what she liked about the old one, because that's a piece of information I paid for once already and can have again free.",
        consequence:
          "It is the sweetness, which is exactly what the eleven others said the opposite of. Two answers, opposite directions, and now you know the drink has two audiences.",
        world: { staff: "trusting" },
      },
      {
        id: "o_c2c",
        text: "Put the old one back on for a fortnight beside the new one and let the two of them settle it between them.",
        consequence:
          "Both go up. The new one outsells the old three to one over a fortnight, and the woman who asked buys the new one twice in the second week.",
        world: { chalkboard: "iced" },
      },
    ],
  },

  "C3-SCA-01": {
    activityId: "C3-SCA-01",
    speakerId: "ray",
    variesOn: "truck",
    prompt: (world) => {
      const where =
        world.truck === "gone_rival"
          ? "Ray is across the road these days"
          : world.truck === "parked"
            ? "Ray's truck is at your kerb"
            : "Ray turns up on a Tuesday without the truck";
      return `${where}, and he wants a second weekend booked before the first one has finished settling. “Same deal, the Sunday as well. Say yes now and I'll hold the pitch.”`;
    },
    options: [
      {
        id: "o_c3a",
        text: "Say yes to the Sunday. He's holding a pitch for me and haggling over a day I haven't lost anything on yet looks small.",
        consequence:
          "You take the Sunday. It runs like the Saturday did, which is to say busy, loud, and difficult to read anything from afterwards.",
        world: { truck: "parked" },
      },
      {
        id: "o_c3b",
        text: "Tell him I'll answer about Sunday when Saturday has actually told me something, and that I'll answer by a date he can plan around.",
        consequence:
          "He grumbles and takes the date. Saturday's numbers come in on the Wednesday and the answer is obvious to both of you within a minute.",
      },
      {
        id: "o_c3c",
        text: "Take the Sunday and use it as the test I didn't design the first time — different combo, same crowd, and count both properly.",
        consequence:
          "You run the Sunday with the coffee-first combo. It does about a third more on drinks than the Saturday did, off the same number of people.",
        world: { truck: "parked", chalkboard: "combo" },
      },
    ],
  },

  "C4-SCA-01": {
    activityId: "C4-SCA-01",
    speakerId: "room",
    variesOn: "till",
    prompt: (world) => {
      const state =
        world.till === "strained"
          ? "The reserve is thinner than it was in August."
          : world.till === "healthy"
            ? "The reserve is where you left it."
            : "There was not much of a reserve to begin with.";
      return `The group head needs a part, and the part is four hundred and eleven pounds, and it is not in any of the numbers you wrote down. ${state} It is a Tuesday.`;
    },
    options: [
      {
        id: "o_c4a",
        text: "Take it out of the reserve and replace it next month. That is what the reserve is for and pretending otherwise helps nobody.",
        consequence:
          "It comes out on the Wednesday and the machine is running by Thursday lunchtime. Next month goes past without any of it going back.",
        world: { till: "strained" },
      },
      {
        id: "o_c4b",
        text: "Find out what else is coming before I touch anything — a part I didn't budget for probably isn't the only one.",
        consequence:
          "The engineer lists four things, two of them within a year. You write all four on the back of the same receipt and the reserve gets a second number.",
        world: { till: "healthy" },
      },
      {
        id: "o_c4c",
        text: "Pay it from the reserve and put the same amount back before I spend anything else, so the number means something next time.",
        consequence:
          "It takes seven weeks to put back and you do not spend anything else in those seven weeks. The tin is full again by the middle of December.",
        world: { till: "healthy" },
      },
    ],
  },

  "C5-SCA-01": {
    activityId: "C5-SCA-01",
    speakerId: "nadia",
    variesOn: "board",
    prompt: (world) => {
      const pinned =
        world.board === "direct_card"
          ? "Your own card is still on the board by the door."
          : world.board === "app_card"
            ? "Their card is still on the board by the door."
            : "The board by the door is clear.";
      return `${pinned} A second app has been in touch — twelve points cheaper, newer, and very keen. Nadia, phone in hand: “Are you on this one as well now?”`;
    },
    options: [
      {
        id: "o_c5a",
        text: "List with them too. Twelve points is twelve points, and being on both means neither one of them owns the way people find me.",
        consequence:
          "You list. The new one does eleven orders in its first month and the old one does not notice, and now there are two sets of terms to read.",
        world: { board: "app_card" },
      },
      {
        id: "o_c5b",
        text: "Ask what happens to those twelve points in a year, because the first one was cheap too, right up until it wasn't.",
        consequence:
          "The rep is straightforward about it: introductory, twelve months. You write the date it ends in the diary, which is the first time you have done that.",
      },
      {
        id: "o_c5c",
        text: "Say no to the second one and spend the same effort on the people already ringing us direct, who cost nothing per order.",
        consequence:
          "You do not list. The direct line goes from fourteen a week to twenty-six over the quarter, and every one of those is yours on any terms you like.",
        world: { board: "direct_card", chalkboard: "direct" },
      },
    ],
  },

  "C6-SCA-01": {
    activityId: "C6-SCA-01",
    speakerId: "ellery",
    variesOn: "till",
    prompt: (world) => {
      const room =
        world.till === "strained"
          ? "It is a month where that would help."
          : world.till === "healthy"
            ? "It is a month where you can think about it properly."
            : "It is a tight month and she has picked it well.";
      return `Ellery's company is opening a second office on the other side of the park, and she would like the same arrangement to cover it. ${room} “Same terms, double the cups. Easy, I'd have thought.”`;
    },
    options: [
      {
        id: "o_c6a",
        text: "Say yes on the same terms. Doubling a thing that already works is the easiest decision I'll be offered this year.",
        consequence:
          "You agree in the doorway. The other side of the park turns out to be twenty minutes each way, and the terms did not have a delivery in them.",
        world: { till: "healthy", staff: "strained" },
      },
      {
        id: "o_c6b",
        text: "Price the second one from what the second one actually costs, because the park is between us and that is somebody's hour.",
        consequence:
          "You put the delivery in the price and she signs it anyway. The hour is paid for, which means somebody can actually be spared to do it.",
        world: { till: "healthy" },
      },
      {
        id: "o_c6c",
        text: "Ask what she'd want if I said no to the second site, because the answer tells me what this arrangement is really worth to her.",
        consequence:
          "She says she would keep the first one, and says it immediately. It is the most useful sentence anybody has said to you across this table.",
        world: { till: "healthy" },
      },
    ],
  },

  "C7-SCA-01": {
    activityId: "C7-SCA-01",
    speakerId: "priya",
    variesOn: "staff",
    prompt: (world) => {
      const room =
        world.staff === "trusting"
          ? "Things have been easier since."
          : world.staff === "strained"
            ? "It has been quiet between you since."
            : "Nothing much has changed either way since.";
      return `${room} She asks whether, given what you agreed, she could also drop the Saturday close — which is not what you agreed, but is what the conversation sounded like.`;
    },
    options: [
      {
        id: "o_c7a",
        text: "Say yes. It's close enough to what I agreed that arguing the difference makes the original agreement feel like a trick.",
        consequence:
          "She takes the Saturday off the rota. Tomas closes it instead, for the fourth week running, and says nothing about that either.",
        world: { staff: "strained" },
      },
      {
        id: "o_c7b",
        text: "Say what I actually agreed and what I didn't, without making it a telling-off — I'd rather be clear now than resentful in March.",
        consequence:
          "You lay both out in about thirty seconds. She says she thought it was worth asking, which is true, and closes the Saturday.",
        world: { staff: "trusting" },
      },
      {
        id: "o_c7c",
        text: "Ask what she needs the Saturday for, and then work out whether there's a version of it the rota can actually carry.",
        consequence:
          "It is one Saturday a month rather than all of them. That the rota can carry, and it takes four minutes to find out and costs nothing.",
        world: { staff: "trusting" },
      },
    ],
  },

  "C8-SCA-01": {
    activityId: "C8-SCA-01",
    speakerId: "marcus",
    variesOn: "beans",
    prompt: (world) =>
      world.beans === "cheap"
        ? `A woman at the till asks, straight out and in front of the queue, what changed about the coffee. Marcus is two feet away with his paper and does not look up, which is not the same as not listening.`
        : `A woman at the till asks, straight out and in front of the queue, whether the coffee has changed — because a friend told her it had. Marcus is two feet away and does not look up.`,
    options: [
      {
        id: "o_c8a",
        text: "Tell her exactly what we buy and why, in front of whoever is listening, and let the queue hear the whole answer.",
        consequence:
          "It takes about forty seconds. Two people in the queue are still talking about it at the door, and Marcus turns a page.",
        world: { chalkboard: "beans_story" },
      },
      {
        id: "o_c8b",
        text: "Give her the short version now and offer the long one when there isn't a queue behind her waiting to order.",
        consequence:
          "She takes the short version and comes back on the Thursday for the long one, which is when you find out she runs the deli on the corner.",
      },
      {
        id: "o_c8c",
        text: "Ask her what she noticed, because whatever her friend told her, she has an opinion about my coffee and I do not have it yet.",
        consequence:
          "She says it is sharper than it was and she cannot say whether she minds. Priya writes it on the docket, unasked, under the date.",
        world: { staff: "trusting" },
      },
    ],
  },

  "C9-SCA-01": {
    activityId: "C9-SCA-01",
    speakerId: "priya",
    variesOn: "rival",
    prompt: (world) => {
      const across =
        world.rival === "promo"
          ? "They have had a board out on the pavement for a fortnight."
          : world.rival === "open"
            ? "They have been open two months now."
            : "The unit opposite is quiet again.";
      return `${across} From Monday they are running free coffee before eight, for a month. Priya, looking at the same window you are: “That's the whole of your morning, that is.”`;
    },
    options: [
      {
        id: "o_c9a",
        text: "Do something for the mornings before Monday. A month of free is a month of habit, and habit is what I'd actually be losing.",
        consequence:
          "You put the loyalty cards on the counter with a doubled first stamp. Forty-one go out in the first week and about half of them come back.",
        world: { regulars: "steady" },
      },
      {
        id: "o_c9b",
        text: "Let it run and watch what comes back after. A month tells me who was here for the coffee and who was here for the price.",
        consequence:
          "The month runs. Nine of your mornings go and six come back, and the six who come back are at the four-top on the Tuesday after it ends.",
        world: { regulars: "returning" },
      },
      {
        id: "o_c9c",
        text: "Go and talk to whoever runs it. There are two cafés on this road now and I'd rather know them than guess at them.",
        consequence:
          "She is twenty-six and has been open nine weeks and is terrified. You come back knowing their rent, which is more than they know about yours.",
        world: { rival: "open" },
      },
    ],
  },
};

/** Both seasons. Eighteen rows, eighteen fallbacks, one lookup. */
export const FOLLOWUPS: Readonly<Record<string, FollowupBeat>> = {
  ...HARD_FOLLOWUPS,
  ...PRO_FOLLOWUPS,
};

export function followupFor(activityId: string): FollowupBeat | null {
  return FOLLOWUPS[activityId] ?? null;
}
