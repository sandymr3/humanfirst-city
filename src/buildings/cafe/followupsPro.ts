// The Level B transfer beats — the third question, nine more of them.
//
// Same two rules as followups.ts, and they matter more here. No tiers. And
// **never a comment on the earlier decision**: on a track where every option had
// a real price, a beat that noticed which price you paid would be a verdict
// wearing a Tuesday's clothes. Each beat varies its opening clause on one named
// world key, so the same question lands differently in a full room and a thin
// one without knowing anything about how the room got that way.
import type { FollowupBeat } from "./followups";

export const PRO_FOLLOWUPS: Readonly<Record<string, FollowupBeat>> = {
  "C1-PRO-01": {
    activityId: "C1-PRO-01",
    speakerId: "nadia",
    variesOn: "regulars",
    prompt: (world) => {
      const room =
        world.regulars === "thin"
          ? "The mornings are thinner than they were in the spring."
          : "The 7:50 window is yours again.";
      return `Six weeks on. ${room} The station café has started opening at seven, and Nadia mentions it on her way out: “Do I need to start planning round that as well?”`;
    },
    options: [
      {
        id: "o_p1a",
        text: "Not unless it turns out to matter. Give me a fortnight to find out what seven o'clock is actually worth to the people who use it.",
        consequence:
          "You count the door before eight for two weeks. It is fourteen people, and eleven of them are the same eleven every single morning.",
        world: { regulars: "steady" },
      },
      {
        id: "o_p1b",
        text: "We'll open at seven from Monday, because you cannot let the place down the road set your hours and expect to keep the crowd.",
        consequence:
          "Seven o'clock from Monday. The first hour is quiet and the staff cost is not, and by Thursday Priya has stopped asking what the plan is.",
        world: { staff: "strained" },
      },
      {
        id: "o_p1c",
        text: "No. They can have seven o'clock — I would rather be the place you come to at ten past eight and actually sit down in.",
        consequence:
          "The hours stay where they are. Two of the early ones go down the road for good, and the four-top fills out later in the morning than it used to.",
        world: { regulars: "steady" },
      },
    ],
  },

  "C2-PRO-01": {
    activityId: "C2-PRO-01",
    speakerId: "priya",
    variesOn: "staff",
    prompt: (world) => {
      const room =
        world.staff === "strained"
          ? "She catches you at the hatch rather than at the bar, which is new."
          : "She has the docket out before you have got your coat off.";
      return `Three weeks later. ${room} “The pastries. Same question as last time — do you want me to just try something, or do you want to do it the way we did the drink?”`;
    },
    options: [
      {
        id: "o_p2a",
        text: "The way we did the drink. One change, one week, and the line written down before either of us looks at the numbers.",
        consequence:
          "She writes the threshold on the docket herself and puts it in your pigeonhole. It comes in eleven under, and neither of you has to argue about what eleven under means.",
        world: { staff: "trusting" },
      },
      {
        id: "o_p2b",
        text: "Just try something. Pastries are not a drink, the shelf life is two days, and a fortnight of design costs more than the experiment does.",
        consequence:
          "She swaps two lines on the Tuesday. Something moves and something does not, and by Friday neither of you can reconstruct exactly what was changed when.",
      },
      {
        id: "o_p2c",
        text: "Do it your way and tell me the rule you used, because I would rather we ended up with two people who can design one of these.",
        consequence:
          "She runs it on instinct, gets a lift, and then spends twenty minutes at the hatch reverse-engineering why. The rule she writes is not the one you would have written.",
        world: { staff: "trusting" },
      },
    ],
  },

  "C3-PRO-01": {
    activityId: "C3-PRO-01",
    speakerId: "ray",
    variesOn: "till",
    prompt: (world) => {
      const room =
        world.till === "strained"
          ? "He has noticed you counting the float twice and has not said anything about it."
          : "He is in a good mood and the van is double-parked outside.";
      return `February, and the folder is back. ${room} “Same again, better number, and I need to know inside the week. I'd rather you told me no early than yes slowly.”`;
    },
    options: [
      {
        id: "o_p3a",
        text: "Give me the volumes from last year and I'll have you an answer Thursday, because the thing that costs us both is me deciding this twice.",
        consequence:
          "The volumes come over that afternoon. You say yes on the Thursday to two thirds of it, and Ray tells you nobody else asks for the year before.",
        world: { beans: "good" },
      },
      {
        id: "o_p3b",
        text: "No, and I'll tell you now rather than Thursday. February is the wrong month for me to be putting cash into a shelf.",
        consequence:
          "He takes it well and goes. The price holds until May, and you spend the intervening months not thinking about the stockroom at all.",
      },
      {
        id: "o_p3c",
        text: "Yes to the same third as last time, on the same terms, and let's stop pretending either of us wants to renegotiate this quarterly.",
        consequence:
          "It is agreed in about ninety seconds. The biro comes out, the folder goes back in the van, and the standing third arrives on the first Tuesday of every month.",
        world: { beans: "good" },
      },
    ],
  },

  "C4-PRO-01": {
    activityId: "C4-PRO-01",
    speakerId: "room",
    variesOn: "till",
    prompt: (world) => {
      const room =
        world.till === "strained"
          ? "The drawer has been light for six weeks and you have stopped being surprised by it."
          : "There is more in the drawer at the end of the month than there was in May.";
      return `January, and the accountant's letter is on the counter next to the takings. ${room} Two lines of it are about the year ahead and neither of them is a question you can leave until March.`;
    },
    options: [
      {
        id: "o_p4a",
        text: "Do the whole year properly tonight — twelve months of what this costs to run — so I stop making this decision one month at a time.",
        consequence:
          "It takes until two and it is the first time you have seen all twelve months on one sheet. Three of them are worse than you had been assuming.",
        world: { till: "healthy" },
      },
      {
        id: "o_p4b",
        text: "Answer the two lines and put the rest away, because a year built in January out of one bad quarter is a year built out of a mood.",
        consequence:
          "You answer both and go home. In April you need the sheet you did not build and you build it then, in a worse week, with less time.",
      },
      {
        id: "o_p4c",
        text: "Answer them with Priya in the room, since she knows what this place costs on a Tuesday better than the accountant ever will.",
        consequence:
          "She corrects two of your numbers inside the first ten minutes. The letter goes back in the post on Thursday with figures neither of you would have got to alone.",
        world: { staff: "trusting" },
      },
    ],
  },

  "C5-PRO-01": {
    activityId: "C5-PRO-01",
    speakerId: "nadia",
    variesOn: "board",
    prompt: (world) => {
      const room =
        world.board === "direct_card"
          ? "There is a card with your own number on it by the door now."
          : "The promo card is still pinned where somebody else put it.";
      return `Spring. ${room} Nadia, waiting for her change: “There's a new one. Cheaper for them, and it says it pays the shops more. Are you going on it?”`;
    },
    options: [
      {
        id: "o_p5a",
        text: "Not until I know who owns it and what happens in year two, because that is the part of the last one nobody read.",
        consequence:
          "You spend an evening on the terms. Year two doubles the commission on anything over a threshold you would hit by August, and you say no on the Tuesday.",
      },
      {
        id: "o_p5b",
        text: "Yes, on a trial. A cheaper channel that pays better is worth finding out about, and I would rather test it than have an opinion about it.",
        consequence:
          "Three months on it. The orders are real, the fee is genuinely lower, and by June the company has been bought by the first one.",
        world: { board: "app_card" },
      },
      {
        id: "o_p5c",
        text: "No. I've spent a year building something that nobody else can reprice, and going back on now would undo the only leverage I have.",
        consequence:
          "You stay off it. Two places on the street go on, and one of them tells you in October that they wish they had waited.",
        world: { board: "direct_card" },
      },
    ],
  },

  "C6-PRO-01": {
    activityId: "C6-PRO-01",
    speakerId: "ellery",
    variesOn: "till",
    prompt: (world) => {
      const room =
        world.till === "tight"
          ? "You have been doing the covers arithmetic in your head since she sat down."
          : "The drawer can take a bad month now, which is a new feeling.";
      return `June, and she is back at the same table. ${room} “There's an event. Two hundred, one morning, four weeks' notice. I'd need a number by Friday.”`;
    },
    options: [
      {
        id: "o_p6a",
        text: "Give me until Wednesday and I'll price it off what it actually costs to do, rather than off what a busy morning feels like.",
        consequence:
          "You cost it properly: two extra pairs of hands, the hire, the milk. The number is higher than your instinct was and she takes it without comment.",
        world: { till: "healthy" },
      },
      {
        id: "o_p6b",
        text: "I'll do it at the account rate. Two hundred in one morning is the kind of thing you say yes to and work out afterwards.",
        consequence:
          "It goes out on time and the room is a wreck by eleven. You work out afterwards that the morning made about forty pounds and cost you a Saturday.",
        world: { staff: "strained" },
      },
      {
        id: "o_p6c",
        text: "Only if it is the nine-fifteen delivery and not two hundred people in here, because this room does not hold that and the regulars do.",
        consequence:
          "She agrees to the delivery version in about a minute. Marcus's table stays Marcus's table, and the account grows without the room noticing that it did.",
        world: { till: "healthy", regulars: "full" },
      },
    ],
  },

  "C7-PRO-01": {
    activityId: "C7-PRO-01",
    speakerId: "priya",
    variesOn: "staff",
    prompt: (world) => {
      const room =
        world.staff === "trusting"
          ? "The rota has been in your handwriting for six weeks and nobody has been near it."
          : "There is fresh pencil on the rota again, in two different hands.";
      return `A month on. ${room} Priya, at the hatch: “The new one starts Monday. What do you want me to tell her about how it works in here?”`;
    },
    options: [
      {
        id: "o_p7a",
        text: "Tell her the standard, on the first day, in the same words I would use to you — and then tell her I will hold everybody to it.",
        consequence:
          "She gets it on the Monday and asks two questions about it. By the third week she is the one repeating it to somebody else on a Saturday.",
        world: { staff: "trusting" },
      },
      {
        id: "o_p7b",
        text: "Tell her what the job is and let the rest arrive, because a standard handed to somebody on day one is a rule and not a culture.",
        consequence:
          "She picks most of it up by watching. What she also picks up is the two things nobody has fixed, and she picks those up just as fast.",
      },
      {
        id: "o_p7c",
        text: "Ask her at the end of the first week what she has noticed, and then tell her which of it is how we meant it to be.",
        consequence:
          "She notices four things and two of them are the ones you have been arguing about since September. The conversation on the Friday is not a comfortable one.",
        world: { staff: "trusting" },
      },
    ],
  },

  "C8-PRO-01": {
    activityId: "C8-PRO-01",
    speakerId: "marcus",
    variesOn: "beans",
    prompt: (world) => {
      const room =
        world.beans === "cheap"
          ? "He has been finishing about two thirds of it for a month."
          : "He has been finishing them, which he does not always.";
      return `Late autumn, and Marcus has folded the paper down. ${room} “There's a man doing tastings up at the market. He asked whether you'd want to do one here.”`;
    },
    options: [
      {
        id: "o_p8a",
        text: "Yes, and I'll do it properly with the roaster in the room, because the only way that is worth anything is if somebody can answer questions.",
        consequence:
          "Eleven people come, which is nine more than you expected. Two of them are in every week after that and one of them asks about the beans by name.",
        world: { chalkboard: "beans_story", regulars: "full" },
      },
      {
        id: "o_p8b",
        text: "Not this year. A tasting is a thing you do when the coffee is where you want it, and mine is where the quarter left it.",
        consequence:
          "You say no and Marcus nods and goes back to the paper. He mentions it again in February, which is how you know he was not just passing it on.",
      },
      {
        id: "o_p8c",
        text: "Yes, if he'll do it on a Tuesday morning — the room is quiet, the regulars are in, and those are the people it is actually for.",
        consequence:
          "Six people, all of them yours, on a Tuesday. Nobody new comes in at all, and the four-top talks about it for a fortnight afterwards.",
        world: { regulars: "full" },
      },
    ],
  },

  "C9-PRO-01": {
    activityId: "C9-PRO-01",
    speakerId: "priya",
    variesOn: "regulars",
    prompt: (world) => {
      const room =
        world.regulars === "thin"
          ? "The four-top has been quiet long enough that neither of you mentions it any more."
          : "The four-top has been full every morning this week.";
      return `March, and the place across the road has changed hands again. ${room} Priya, restacking: “They're shut for a refit. Six weeks, apparently. Do we do anything about that?”`;
    },
    options: [
      {
        id: "o_p9a",
        text: "Nothing aimed at them. Six weeks of their customers is six weeks to find out whether we can keep anybody, which is a different question.",
        consequence:
          "You change nothing and count instead. Of the people who come across, about a fifth are still coming in June, and you know exactly which fifth.",
        world: { regulars: "steady" },
      },
      {
        id: "o_p9b",
        text: "Everything we can. Six weeks with no competition on this street is the cheapest chance we will ever get to win the habit back.",
        consequence:
          "Boards, an offer, longer hours, all six weeks of it. The room is full until they reopen, and in the eighth week you are back where you were in February.",
        world: { till: "tight" },
      },
      {
        id: "o_p9c",
        text: "One thing, done properly — fix the half eight queue while we have the room to do it in without anybody noticing.",
        consequence:
          "You move the case, the reader and the milk fridge in the second week. When they reopen, the half eight is the fastest it has been since you took this on.",
        world: { regulars: "returning" },
      },
    ],
  },
};
