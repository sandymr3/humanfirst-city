// The decision content — two authored beats per mission, nine leaves each.
//
// **There are no tiers in this file, and there must never be any.** Which option
// is Developing, Strong or Advanced lives in the registry rubric on the server
// and is resolved from the submitted path; a tier on the client is a tier a
// curious player can read. What ships here is the text, the consequence, and the
// world write — the three things the room needs to play the beat.
//
// The rules the prose is held to (PRD §9.2, ADR-005 §11.4), because they are the
// difference between a decision and a quiz:
//
//   * every option is written by somebody who believes it, and carries its own
//     justification — no bare imperatives sitting next to reasoned arguments;
//   * choice length is held to parity, because it is the tier leak nobody looks
//     for. 13–33 words, and no trio spread wider than 8. Checked in trees.test.ts,
//     not by eye;
//   * no option marks itself with hedging, glibness or author's praise;
//   * no consequence tells the player whether they did well. The room reports
//     what happened and stops there.
import type { WorldPatch } from "./world";
import { PRO_TREES } from "./treesPro";

export interface Choice {
  /** "a" | "b" | "c" — the letter that goes on the wire in the trace path. */
  id: string;
  text: string;
  /** What the room does about it. Four to six seconds of consequence, no verdict. */
  consequence: string;
  world?: WorldPatch;
}

export interface FollowBranch {
  /** Where the branch picks up, in the host's voice. */
  prompt: string;
  choices: readonly Choice[];
}

export interface Tree {
  activityId: string;
  /** The scene, before anybody says anything. */
  stage: string;
  /** The question that opens it. */
  prompt: string;
  seed: readonly Choice[];
  /** Keyed by the seed choice that led here — the follow-up is branch-specific. */
  follow: Readonly<Record<string, FollowBranch>>;
}

/**
 * The trace path for a completed decision, exactly as the backend's evalTrace
 * expects it (PRD §10.4). It walks the path backwards for the last node it knows,
 * so the leaf is what scores and the two nodes before it are context.
 */
export function tracePath(activityId: string, seed: string, follow: string): string[] {
  return [
    `${activityId}.seed`,
    `${activityId}.${seed}`,
    `${activityId}.${seed}.follow`,
    `${activityId}.${seed}.${follow}`,
  ];
}

const HARD_TREES: Readonly<Record<string, Tree>> = {
  // Fully worked in PRD §9.3. The seed and follow-up text below is the shipping
  // text from that section verbatim; the leaf consequences are authored to it.
  "C1-HARD-01": {
    activityId: "C1-HARD-01",
    stage:
      "8:05. The bell goes. Nadia's already reaching for her card before she's at the counter, the way she is every morning. She orders, then stops halfway through putting her phone away. It's the third time this week someone's asked. Behind you, Priya doesn't say anything, which is Priya's way of saying something. There's enough in the till for one move this month.",
    prompt: "You still don't do oat, do you?",
    seed: [
      {
        id: "a",
        text: "Chalk a card and prop it by the till — Oat milk? Should we? — and see how many people actually react over two days.",
        consequence:
          "You prop the card by the till. Over two days eleven people tap it and three write their names underneath in Priya's chalk. You order one crate of oat with a number in your head instead of a hope.",
        world: { chalkboard: "oat_asked" },
      },
      {
        id: "b",
        text: "Order oat and almond this week. People are telling you what they want, and in a shop this size the one who moves first wins.",
        consequence:
          "Two crates arrive Thursday. The oat moves. Three weeks later you find the almond behind the fridge, unopened, four days past date. You bought what people said, not what they'd pay for.",
        world: { chalkboard: "oat_plus", till: "tight" },
      },
      {
        id: "c",
        text: "Ask Nadia — and the others who've asked — what they'd actually do if you had it. Find out whether it's a nice-to-have or the reason they'd stop coming.",
        consequence:
          "Nadia tells you she gets her second coffee at the place by the station three mornings a week, because they do oat and you don't. Two others say the same thing without being asked. It was never really about milk.",
        world: { regulars: "thin" },
      },
    ],
    follow: {
      a: {
        prompt:
          "The crate arrives. Oat sells — nine cups, then eleven, then seven. Not the flood the card suggested. Priya, wiping down: “So is that good or not?”",
        choices: [
          {
            id: "a",
            text: "Eleven people said yes to a card and nine actually bought. Use the gap between those two numbers to calibrate the next test, not the next order.",
            consequence:
              "Priya writes both numbers on the corner of the board and leaves them there. The next thing you ask the room about, you ask it the same way, and you already know roughly what a yes on a card is worth.",
            world: { chalkboard: "oat" },
          },
          {
            id: "b",
            text: "Nine cups a day is nine cups a day. Bring the almond in too and give the whole range a fair run before judging any of it.",
            consequence:
              "The almond goes on beside the oat. Between them they do about eleven cups, which is two more than the oat was doing alone, off two cartons instead of one.",
            world: { chalkboard: "oat_plus" },
          },
          {
            id: "c",
            text: "Hold at one crate a week, leave the card up another fortnight, and let the reorder rate make the call instead of you.",
            consequence:
              "The card stays up. The reorder settles at one crate, steady, week after week. It is not a decision so much as a number you now have and did not have before.",
            world: { chalkboard: "oat" },
          },
        ],
      },
      b: {
        prompt:
          "The almond's a write-off and the till is thinner than it should be in a good month. Priya, not looking up: “We keeping the almond?”",
        choices: [
          {
            id: "a",
            text: "Keep both on. Pulling something a fortnight after adding it makes the place look like it doesn't know what it is.",
            consequence:
              "Both stay up. The almond goes on sitting there, and every few weeks a carton goes past date and gets poured away at close, quietly, by whoever is on.",
            world: { chalkboard: "oat_plus" },
          },
          {
            id: "b",
            text: "Cut the almond, and spend the afternoon finding out what the oat buyers actually came in for. The crate's already lost — it should at least buy the answer.",
            consequence:
              "You spend the afternoon asking. Most of them are the 7:50 crowd and most of them are going somewhere after. Priya writes the window on the corner of the board and it stays there for the rest of the season.",
            world: { chalkboard: "oat" },
          },
          {
            id: "c",
            text: "Drop the almond, keep the oat, and from now on reorder against what sold last week rather than what you hoped would sell.",
            consequence:
              "The almond comes off. You start writing last week's numbers on the back of the order sheet before you place it, which takes four minutes and has not cost you a carton since.",
            world: { chalkboard: "oat" },
          },
        ],
      },
      c: {
        prompt:
          "You know now: it's the commuters, and it's the station café. Priya's already worked out what you're going to say. “So do we chase them, or do we not?”",
        choices: [
          {
            id: "a",
            text: "Bring oat in and aim the whole morning at commuters — faster service, a takeaway price, out of the door in ninety seconds.",
            consequence:
              "The mornings get quicker and louder. Some of the regulars stop sitting down, and the four-top has a gap in it on Tuesdays that did not use to be there.",
            world: { chalkboard: "oat", regulars: "steady" },
          },
          {
            id: "b",
            text: "Oat, yes. But the thing you're actually fixing is the 7:50-to-8:20 window. Time the queue for a week, then design that half hour properly.",
            consequence:
              "Priya writes 7:50 – 8:20 on the corner of the chalkboard and leaves it there. You will still be looking at those numbers in week ten, and they will still be the right ones.",
            world: { chalkboard: "oat", regulars: "steady" },
          },
          {
            id: "c",
            text: "Match the station café properly — oat, soy, all of it — so there's nothing left worth walking down the road for.",
            consequence:
              "The whole range goes up on the board. It takes three cartons and a shelf you did not have, and the fridge is fuller every morning than the sales are by close.",
            world: { chalkboard: "plant_full", till: "tight" },
          },
        ],
      },
    },
  },

  // §9.5 gives the seed layer as shipping text and specifies the follow-up
  // branches by prompt and intent. The seeds below are that text; the follow-ups
  // and every consequence are authored against it.
  "C2-HARD-01": {
    activityId: "C2-HARD-01",
    stage:
      "Two weeks in. Priya has the numbers on the back of a docket and has clearly been waiting for you to ask. The iced drink went up on the board in your handwriting and it has been doing four a day since.",
    prompt: "So. Are we talking about the iced thing, or are we leaving it up there?",
    seed: [
      {
        id: "a",
        text: "Ask the people who walked past it why they didn't order it, and then change the recipe on whatever they actually tell you.",
        consequence:
          "You ask eleven people over two days. Nine of them say the same word, which is sweet, and two say they did not know what was in it. Priya changes the syrup that afternoon.",
        world: { chalkboard: "iced" },
      },
      {
        id: "b",
        text: "Keep pushing it. A drink this good takes a month to find its people, and pulling it early kills things that would have worked.",
        consequence:
          "You leave it up. Four a day becomes four a day becomes four a day, through a hot fortnight when everything else on the board moved.",
        world: { chalkboard: "iced" },
      },
      {
        id: "c",
        text: "Change exactly one thing — the price or the name, not both — for a week, and let the difference in the numbers decide it.",
        consequence:
          "You pick the name and give it a week. It goes from four a day to seven, which is not nothing, and you have a docket with two numbers on it that mean something.",
        world: { chalkboard: "iced_renamed" },
      },
    ],
    follow: {
      a: {
        prompt:
          "Less syrup, and it moves — six, then eight. Priya, rinsing a jug: “So do we do that again, or was that a one-off?”",
        choices: [
          {
            id: "a",
            text: "Fix the recipe and leave it there. It's selling now, and pulling the whole thing apart again to prove a point costs us a week.",
            consequence:
              "The recipe stays where it landed. It goes on doing seven or eight a day, and nobody writes any of it down anywhere.",
            world: { chalkboard: "iced" },
          },
          {
            id: "b",
            text: "Keep asking. Every drink on that board came from somebody's guess, so ask about all of them and find out which guesses were wrong.",
            consequence:
              "You ask about the flat white next, and then the cortado. The cortado turns out to be a spelling problem rather than a coffee problem, which takes four minutes to fix.",
            world: { staff: "trusting" },
          },
          {
            id: "c",
            text: "Write down what we just did — ask, change one thing, count — and use it every time we put something new on that board.",
            consequence:
              "Priya writes the three steps on the inside of the cupboard door, where the rota used to be. You will find yourself looking at it again in week sixteen.",
            world: { staff: "trusting" },
          },
        ],
      },
      b: {
        prompt:
          "A month gone and it is still four a day, in the hottest fortnight of the year. Priya, not looking up from the docket: “I backed this too, you know.”",
        choices: [
          {
            id: "a",
            text: "Hold it another month. We told the team we believed in it, and reversing now teaches them our decisions are weather.",
            consequence:
              "It stays up another month at four a day. Tomas stops offering it to people at the till, without ever being told to, and nobody mentions that either.",
            world: { staff: "strained" },
          },
          {
            id: "b",
            text: "Take it down quietly at the end of the week, and put the fridge space behind something we already know sells.",
            consequence:
              "It comes off on the Sunday. Nobody asks where it went, which is its own answer, and the space goes to the bottled thing that was always doing six.",
            world: { chalkboard: "base" },
          },
          {
            id: "c",
            text: "Say out loud that I got this one wrong, then work out with the team what we'd need to see before we back the next one.",
            consequence:
              "You say it at close, in about nine words. Priya looks up. The next thing that goes on the board goes up with a number attached to it and a date to check it.",
            world: { staff: "trusting" },
          },
        ],
      },
      c: {
        prompt:
          "It lifted — but you find the price went up the same week the name changed, because Tomas re-did the board. Priya: “So which one was it?”",
        choices: [
          {
            id: "a",
            text: "Run it again properly. Put the price back for a week and leave the new name alone, so we learn which one actually did the work.",
            consequence:
              "You put the price back for a week. It holds at seven, which tells you it was the name, and costs you about nine pounds to find out.",
            world: { chalkboard: "iced_renamed" },
          },
          {
            id: "b",
            text: "Take the win and move on. It's selling nearly twice what it was, and I'd rather spend the week on something that isn't working yet.",
            consequence:
              "You leave it. It settles at seven a day and you never do find out which change did it, which matters exactly once, in week ten.",
            world: { chalkboard: "iced_renamed" },
          },
          {
            id: "c",
            text: "Fix how we test rather than this one drink — one change at a time, written on the board before we start, whoever's on.",
            consequence:
              "Priya rules a line down the docket: what we changed, what we expected, what happened. It is on the third docket by week ten and she has stopped needing to be asked.",
            world: { staff: "trusting" },
          },
        ],
      },
    },
  },

  "C3-HARD-01": {
    activityId: "C3-HARD-01",
    stage:
      "The hottest day of the year. Ray's truck is at the kerb before he is at the door, and the smell of it is in the room before he is. He needs an answer tomorrow, he says, because the market wants the same pitch.",
    prompt: "Your crowd, my fries, Saturday. Tell me what's wrong with that.",
    seed: [
      {
        id: "a",
        text: "Yes, but structured: you sell the drinks, he sells the food, and you split a combo so both sides have a reason to send people across.",
        consequence:
          "You shake on it at the counter and Priya chalks the combo under the menu. Saturday is louder than this room has been since you took it on.",
        world: { truck: "parked", chalkboard: "combo" },
      },
      {
        id: "b",
        text: "Say no. You'd be handing your Saturday lunch trade to a man with a fryer, and you can't model what that costs until it's already gone.",
        consequence:
          "Ray takes it well, which is worse. Two Saturdays later the truck is on the opposite kerb, outside the shuttered unit, with a queue down the pavement.",
        world: { truck: "gone_rival" },
      },
      {
        id: "c",
        text: "Yes to a month, with a date in the diary to look at the numbers together and a clean way out if it isn't working.",
        consequence:
          "You write the date on the back of the docket and he writes it on his hand. The first Saturday does two hundred covers between you and neither of you knows yet whose they were.",
        world: { truck: "parked" },
      },
    ],
    follow: {
      a: {
        prompt:
          "His crowd is enormous and it buys almost no coffee — chips, cans, gone. Ray, leaning on the counter: “Good day though, wasn't it.”",
        choices: [
          {
            id: "a",
            text: "Reopen the split now, while it's still friendly, and price the combo so the coffee side is actually worth staffing.",
            consequence:
              "You redo the numbers on a napkin with him standing there. He agrees faster than you expected, which tells you he had already run them himself.",
            world: { truck: "parked" },
          },
          {
            id: "b",
            text: "Ride it out for the month. Footfall is footfall, and some of those faces come back on a Tuesday when he isn't there.",
            consequence:
              "You count the Tuesdays. Eleven faces come back across four weeks, which is more than none and less than the Saturday staffing cost.",
            world: { truck: "parked" },
          },
          {
            id: "c",
            text: "Redesign the combo so a coffee is the thing that unlocks the discount, not the thing bolted onto it afterwards.",
            consequence:
              "Priya rewrites the board so the coffee comes first. The queue reads it on the way past and about a third of them change what they order.",
            world: { chalkboard: "combo", truck: "parked" },
          },
        ],
      },
      b: {
        prompt:
          "He's across the road now and the queue is on his side of the street. Priya, watching through the glass: “That's our Saturday, that is.”",
        choices: [
          {
            id: "a",
            text: "Go over and talk to him. The pitch is gone, but there's still a version of this where we're not competing on the same twenty metres.",
            consequence:
              "You go over on the Sunday. He is straightforward about it, the way he always was, and you come back with a Thursday instead of a Saturday.",
            world: { truck: "parked" },
          },
          {
            id: "b",
            text: "Hold the line. We said no for reasons that are still true, and chasing him now says the reasons were never the reason.",
            consequence:
              "You hold. Saturdays settle about a fifth below where they were, and the room is quieter in a way the regulars seem to quite like.",
            world: { truck: "gone_rival", regulars: "steady" },
          },
          {
            id: "c",
            text: "Give people a reason to be here on a Saturday that has nothing to do with fries, and build the day around that instead.",
            consequence:
              "You put the long table by the window and the papers out from ten. It fills slowly, with a different crowd, and it holds.",
            world: { truck: "gone_rival", regulars: "steady" },
          },
        ],
      },
      c: {
        prompt:
          "The date arrives. The numbers are up, but so are the hours, and neither of you can say cleanly whether it worked. Ray: “Well?”",
        choices: [
          {
            id: "a",
            text: "Extend it another month. It's clearly not failing, and one more cycle gives us a comparison we can actually read.",
            consequence:
              "You go again. The second month reads exactly like the first, and the two of you have the same conversation at the end of it, in the same doorway.",
            world: { truck: "parked" },
          },
          {
            id: "b",
            text: "End it here. We agreed a way out precisely so we wouldn't have to argue about ambiguous numbers, and these are ambiguous.",
            consequence:
              "You end it on the terms you wrote down. He shakes your hand, parks two streets over the following week, and still comes in for a flat white on Tuesdays.",
            world: { truck: "absent" },
          },
          {
            id: "c",
            text: "Write down what would count as working before we extend — a number, a date — and then extend against that.",
            consequence:
              "You put two figures on the back of the same docket. Four weeks later the answer is legible in about ten seconds, and neither of you has to argue about it.",
            world: { truck: "parked" },
          },
        ],
      },
    },
  },

  "C4-HARD-01": {
    activityId: "C4-HARD-01",
    stage:
      "22:30. Chairs up, machine cooling and ticking as it goes. One pendant on over the counter. The month's takings are stacked in front of you — the best four weeks since you took the place on. It is also August, and you have run this room long enough to know what September looks like.",
    prompt: "The takings are still on the counter. It is twenty to eleven.",
    seed: [
      {
        id: "a",
        text: "Replace the machine. It's the oldest thing in the room, it's what everything runs through, and a good month is exactly when you fix it.",
        consequence:
          "The new one lands on the counter in week three of September and it is beautiful. The payment lands on the third of every month after that.",
        world: { machine: "upgraded", till: "strained" },
      },
      {
        id: "b",
        text: "Put most of it aside as a cushion and spend a little on the one thing customers have actually asked for out loud.",
        consequence:
          "You put a number on the back of a receipt and move it somewhere you cannot get at easily. What is left buys the loyalty cards Priya has been asking about for a year.",
        world: { till: "healthy", staff: "trusting" },
      },
      {
        id: "c",
        text: "Back the single spend most likely to bring the same people through that door again next week, and leave the rest exactly where it is.",
        consequence:
          "You spend it on the thing that makes people come back rather than the thing that makes them notice, which is less satisfying and takes about a month to show up.",
        world: { till: "healthy" },
      },
    ],
    follow: {
      a: {
        prompt:
          "October is a fifth below your worst guess, and the machine payment is not. Priya has started asking, carefully, whether her hours are safe.",
        choices: [
          {
            id: "a",
            text: "Tell her the truth with a number in it — how many weeks this covers at this rate — and then trim what can be trimmed away from hours.",
            consequence:
              "You say eleven weeks, because it is eleven weeks. She goes quiet and then starts finding things to cut that you had not thought of.",
            world: { staff: "trusting", till: "strained" },
          },
          {
            id: "b",
            text: "Keep the number to myself until I have to share it. Worrying the team about a month that might still turn is its own kind of damage.",
            consequence:
              "You keep it. She stops asking after a fortnight, and starts checking the rota a week further ahead than she used to.",
            world: { staff: "strained" },
          },
          {
            id: "c",
            text: "Say plainly how far this goes, and then give October a job — use the quiet mornings for the window I've never had time to fix.",
            consequence:
              "The mornings get used. By the time November arrives the 7:50 half hour runs about ninety seconds faster per person and nobody outside this room noticed it happen.",
            world: { staff: "trusting" },
          },
        ],
      },
      b: {
        prompt:
          "October undershoots the cushion by about a fortnight's worth. The loyalty cards are working, but slowly, and slowly is not what a fortnight short needs.",
        choices: [
          {
            id: "a",
            text: "Push the scheme harder. Double the stamps for a month and buy the traffic back while there is still a scheme to push.",
            consequence:
              "Double stamps runs for four weeks. The traffic comes, and so does a drawer full of cards that are now worth twice what you priced them at.",
            world: { till: "strained" },
          },
          {
            id: "b",
            text: "Separate the two problems. Fund the fortnight from something reversible and let the scheme run on its own timeline instead of rescuing me.",
            consequence:
              "You borrow against the thing you can unwind, and leave the cards alone. They come good in January, on their own schedule, exactly as slowly as before.",
            world: { till: "healthy" },
          },
          {
            id: "c",
            text: "Trim a fortnight of hours by agreement, close an hour earlier on the dead days, and protect the cushion rather than the schedule.",
            consequence:
              "You close at four on Mondays and Tuesdays through November. Two people take the hours off willingly and one of them is relieved, which you had not expected.",
            world: { till: "healthy", staff: "strained" },
          },
        ],
      },
      c: {
        prompt:
          "The spend has not shown up in the numbers yet, and it has been five weeks. The room is quieter than the summer and the cushion has not moved.",
        choices: [
          {
            id: "a",
            text: "Give it another month before judging it. Things that bring people back are slow by definition, and pulling early proves nothing at all.",
            consequence:
              "You give it four more weeks. In the sixth week the Tuesday count is up eleven, which is either the spend or the weather, and you will never be sure which.",
            world: { till: "healthy" },
          },
          {
            id: "b",
            text: "Work out what I'd expect to see by now if it were working, and check that instead of waiting to feel differently about it.",
            consequence:
              "You write the number you would expect and compare it. It is short by about a third, which is not a failure and is not a result either, and now you know that.",
            world: { till: "healthy" },
          },
          {
            id: "c",
            text: "Stop the spend and put it back in the cushion. Five weeks with nothing visible is five weeks I could have been holding cash.",
            consequence:
              "It goes back in the tin. The Tuesday count stays where it was, which is the same thing it did while you were spending, and now costs nothing.",
            world: { till: "healthy" },
          },
        ],
      },
    },
  },

  "C5-HARD-01": {
    activityId: "C5-HARD-01",
    stage:
      "There is a promo card on the community board that you did not pin there. It is for a delivery app, and it is for this café. Nadia mentions, on her way past, that she has been ordering through it for a month. She means it as a compliment.",
    prompt: "It's so much easier now you're on there. You did know you were on there?",
    seed: [
      {
        id: "a",
        text: "Do the arithmetic on their cut first, and then lift the delivery prices by enough to come out roughly where you started.",
        consequence:
          "The cut is thirty per cent. You put delivery prices up by a third and the orders keep coming, from people who have no idea the price on their screen is not the price on the board.",
        world: { board: "app_card", chalkboard: "app" },
      },
      {
        id: "b",
        text: "List with them properly. Reach you can't buy is worth a cut you don't like, and every order is an order you weren't getting.",
        consequence:
          "You sign the form. Orders go from nine a week to forty, and the margin on all forty is thinner than the margin on the nine ever was.",
        world: { board: "app_card", chalkboard: "app" },
      },
      {
        id: "c",
        text: "Use it to get found, and then give every delivery bag a reason to order direct from us the next time instead.",
        consequence:
          "Priya puts a card in every bag with the phone number and ten per cent off. Fourteen people ring the shop in the first month, which is fourteen people the app does not have.",
        world: { board: "direct_card" },
      },
    ],
    follow: {
      a: {
        prompt:
          "It holds for two months. Then the app raises its commission by four points and emails you about it on a Friday afternoon.",
        choices: [
          {
            id: "a",
            text: "Put the delivery prices up again to match. It worked the first time, and the people ordering clearly aren't pricing us against the board.",
            consequence:
              "You move them again. Nothing visible happens for six weeks, and then the reorder rate on delivery starts sliding about two per cent a week.",
            world: { chalkboard: "app" },
          },
          {
            id: "b",
            text: "Work out at what commission this stops being worth doing at all, write the number down, and decide now rather than every time they email.",
            consequence:
              "You write thirty-eight per cent on the inside of the cupboard door. When the next email comes in February it takes about a minute to know what it means.",
            world: { chalkboard: "app" },
          },
          {
            id: "c",
            text: "Absorb this one and put the effort into the direct channel instead, so the next rise is somebody else's problem rather than mine.",
            consequence:
              "You eat the four points and start putting cards in the bags. It is slower than raising a price and it is the only one of the two that compounds.",
            world: { board: "direct_card" },
          },
        ],
      },
      b: {
        prompt:
          "Forty orders a week now, and the app is a third of your revenue. Priya, boxing another one: “Are we a café or are we a kitchen?”",
        choices: [
          {
            id: "a",
            text: "Keep going. A third of revenue is a third of revenue, and turning it down on principle is not a position this place can afford.",
            consequence:
              "It goes to forty per cent by Christmas. The room is quieter and the kitchen is louder, and the till says the same number it always did.",
            world: { chalkboard: "app", regulars: "thin" },
          },
          {
            id: "b",
            text: "Cap it. Take delivery orders only outside the morning rush, so the room in front of me stays the thing this place actually is.",
            consequence:
              "You switch it off until ten. The mornings come back, the app volume drops by about a quarter, and Priya stops asking the question.",
            world: { regulars: "steady" },
          },
          {
            id: "c",
            text: "Start moving the best of them off the app and onto us, one bag at a time, before a third becomes a half.",
            consequence:
              "The cards go in the bags. It takes eleven weeks to move about sixty people, and every one of them is a person the app can no longer reprice.",
            world: { board: "direct_card" },
          },
        ],
      },
      c: {
        prompt:
          "The direct line is doing fourteen a week and the app is doing thirty. The app's rep calls to say they have noticed the cards in the bags.",
        choices: [
          {
            id: "a",
            text: "Take the cards out. Thirty orders a week is worth more than fourteen, and picking a fight with them over it costs me both.",
            consequence:
              "The cards come out. The direct line settles back to about five a week, which is the five who were always going to ring anyway.",
            world: { board: "app_card" },
          },
          {
            id: "b",
            text: "Leave them in and take the call. They can drop us if they want, but I'd rather find out now what they'll actually do about it.",
            consequence:
              "They do not drop you. They send a longer email, and the cards stay in, and the direct line is at twenty-two by the end of the quarter.",
            world: { board: "direct_card" },
          },
          {
            id: "c",
            text: "Keep both, and stop treating it as a fight — build the direct line so that whatever they decide, it isn't the thing that decides this.",
            consequence:
              "You build both. By spring the direct line is a third of delivery on its own, and the next commission email is genuinely just an email.",
            world: { board: "direct_card", chalkboard: "direct" },
          },
        ],
      },
    },
  },

  "C6-HARD-01": {
    activityId: "C6-HARD-01",
    stage:
      "She has taken the four-top by the window — Marcus's table, which nobody mentions and everybody notices. Laptop open, a coffee she bought herself, and a number she decided on before she came in. Marcus is standing near the door with his paper.",
    prompt:
      "Forty per cent, and we'd take sixty cups a week, every week. That's a good problem to have.",
    seed: [
      {
        id: "a",
        text: "Ask what they actually need before talking price, then build a package that serves it at a number that still works for me.",
        consequence:
          "It turns out they need it at half eight, in one delivery, in something they can carry upstairs. None of which is a discount, and all of which you can do.",
        world: { till: "healthy" },
      },
      {
        id: "b",
        text: "Take the forty per cent. A standing weekly order is the only predictable revenue in this building, and predictable is worth paying for.",
        consequence:
          "You shake on it. Sixty cups go out every Tuesday at a number that covers the beans and the cups and about eleven minutes of somebody's time.",
        world: { till: "healthy", staff: "strained" },
      },
      {
        id: "c",
        text: "Offer a smaller discount, tied to a minimum weekly order and a commitment up front, so the price matches the certainty I actually get.",
        consequence:
          "She takes twenty-five per cent on a three-month commitment without much of a pause, which tells you something about where forty came from.",
        world: { till: "healthy" },
      },
    ],
    follow: {
      a: {
        prompt:
          "Six weeks in it is running well, and she asks — pleasantly — whether the same arrangement could cover their second floor as well. That is a hundred and forty cups.",
        choices: [
          {
            id: "a",
            text: "Say yes and work out the logistics after. An order that size is not something this place gets offered twice in a year.",
            consequence:
              "You say yes on the Tuesday. By the Thursday you have worked out it needs a second urn and somebody in at seven, and you have already agreed the price.",
            world: { till: "healthy", staff: "strained" },
          },
          {
            id: "b",
            text: "Work out what a hundred and forty actually costs this room to make first, and price the second floor from that rather than from the first.",
            consequence:
              "It costs more per cup than sixty did, not less, because it needs a person. You price it accordingly and she does not blink, which is its own information.",
            world: { till: "healthy" },
          },
          {
            id: "c",
            text: "Say yes to the cups and no to the hour — I'll do a hundred and forty at nine, not at half eight, and here's why.",
            consequence:
              "She takes nine o'clock. The whole thing turns out to have been about their meeting slot rather than about coffee, which you could have asked in week one.",
            world: { till: "healthy" },
          },
        ],
      },
      b: {
        prompt:
          "Tuesdays are now a shift on their own and the margin on sixty cups is about the margin on nine. Priya, boxing them up: “Is this actually worth it?”",
        choices: [
          {
            id: "a",
            text: "Hold the deal and find the time somewhere else. We agreed a price, and reopening it eight weeks later is not a thing I want to be.",
            consequence:
              "You hold it. Tuesdays stay a shift, and the cost of them turns up in November as a person you cannot afford to roster on a Saturday.",
            world: { staff: "strained" },
          },
          {
            id: "b",
            text: "Go back and reset it honestly — I priced this wrong, here is what it costs, here is what I can do at that number.",
            consequence:
              "She listens to the whole thing and then says she wondered when you would call. The new number is nine per cent better and takes four minutes to agree.",
            world: { till: "healthy" },
          },
          {
            id: "c",
            text: "Keep the price and change what we deliver — same cups, made in a way that doesn't cost a shift, and tell her that's the trade.",
            consequence:
              "Urns instead of individual cups, one drop instead of three. She does not mind at all, and Tuesday goes back to being a Tuesday.",
            world: { till: "healthy", staff: "easy" },
          },
        ],
      },
      c: {
        prompt:
          "Two months in, a competitor offers her the same volume at your original forty. She mentions it, pleasantly, on her way past the counter.",
        choices: [
          {
            id: "a",
            text: "Match it. Losing a standing order over five points is losing a standing order, and there's another café on every street.",
            consequence:
              "You match. She takes it, the commitment quietly comes off the table with it, and the order is now the same size and half the certainty.",
            world: { till: "strained" },
          },
          {
            id: "b",
            text: "Hold the number and remind her what the commitment buys her — and be genuinely willing to hear her say no to that.",
            consequence:
              "She stays. She says the delivery slot is worth more than the five points, which is what she was really telling you when she mentioned it.",
            world: { till: "healthy" },
          },
          {
            id: "c",
            text: "Ask what the other offer doesn't include, and rebuild ours around whatever that turns out to be rather than around the number.",
            consequence:
              "It does not include the half-eight drop and it does not include one invoice a month. You keep both and the price, and she seems relieved.",
            world: { till: "healthy" },
          },
        ],
      },
    },
  },

  "C7-HARD-01": {
    activityId: "C7-HARD-01",
    stage:
      "First grey day of the autumn. She has been late four times in two weeks, and it lands on whoever opened — which has been Tomas, twice, without saying anything about it. The rota by the pass-through has corrections on it that are not yours.",
    prompt: "You wanted a word. Here, or out the back?",
    seed: [
      {
        id: "a",
        text: "Talk to her privately first, find out what is actually going on, and agree a fix between the two of us before anything else.",
        consequence:
          "It is her mother, and it is the eight-fifteen bus, and she has not said because she did not want it to become a thing. It takes six minutes to find out.",
        world: { staff: "trusting" },
      },
      {
        id: "b",
        text: "Give a clear warning. Lateness that goes unaddressed in a team this size becomes everybody's lateness inside about a month.",
        consequence:
          "You say it plainly and she takes it plainly. She is on time for three weeks, and she stops telling you things she used to tell you.",
        world: { staff: "strained" },
      },
      {
        id: "c",
        text: "Ask, listen, and then deal with both the behaviour and its cause — adjust what I can support without moving the standard itself.",
        consequence:
          "You move her start to half past and you say out loud that half past is now the time. Both halves of that sentence turn out to matter.",
        world: { staff: "trusting" },
      },
    ],
    follow: {
      a: {
        prompt:
          "It is sorted, quietly. Then Tomas asks — reasonably — why she gets a later start and he does not, and he has clearly been waiting to ask.",
        choices: [
          {
            id: "a",
            text: "Tell him it's between me and her. Her reasons are hers, and I'm not trading somebody's private business for a quiet rota.",
            consequence:
              "He accepts it and does not believe it. The pencil corrections on the rota stop appearing, which is not the same as them not being wanted.",
            world: { staff: "strained" },
          },
          {
            id: "b",
            text: "Tell him the rule without the reason — anybody can ask for a start time and I'll say yes if the room still works.",
            consequence:
              "He asks for Thursdays at ten that afternoon. The room still works, so you say yes, and by December three people have asked.",
            world: { staff: "trusting" },
          },
          {
            id: "c",
            text: "Ask him what he actually wants, because he did not raise this to be told about her — and then answer that.",
            consequence:
              "He wants two Saturdays a month off, and has done since June. It has nothing to do with her and he has never once said it.",
            world: { staff: "trusting" },
          },
        ],
      },
      b: {
        prompt:
          "On time for three weeks, and then late again — badly, on a Saturday. She does not offer an explanation this time, and does not seem to expect to be asked for one.",
        choices: [
          {
            id: "a",
            text: "Follow through on exactly what I said I'd do. A warning I don't act on is worse than the one I never gave.",
            consequence:
              "You do what you said. It is short and it is not pleasant, and she works the rest of the shift the way she always does, which is well.",
            world: { staff: "strained" },
          },
          {
            id: "b",
            text: "Ask what changed three weeks ago, because something did, and I never actually asked her the first time.",
            consequence:
              "It is the bus, and it has been the bus since September. She says it flatly, like somebody who assumed you already knew and had decided not to care.",
            world: { staff: "trusting" },
          },
          {
            id: "c",
            text: "Hold the standard and open the conversation at the same time — this still can't happen, and I want to know why it is.",
            consequence:
              "Both things get said in the same two minutes. She looks at you differently for the second one, and the rota gets a pencil correction that week that helps.",
            world: { staff: "trusting" },
          },
        ],
      },
      c: {
        prompt:
          "Half past holds. Then she asks whether the same flexibility could cover Fridays, which is the day this room genuinely cannot spare her.",
        choices: [
          {
            id: "a",
            text: "Say yes. I set the precedent when I moved her start, and taking it back on a Friday makes the whole thing conditional.",
            consequence:
              "You say yes. Friday mornings run a person short for a month, and Tomas covers two of them without being asked and without looking pleased about it.",
            world: { staff: "strained" },
          },
          {
            id: "b",
            text: "Say no to Friday and say why — the standard didn't move, only the start time did, and Friday is where the room actually breaks.",
            consequence:
              "She takes it without argument, which surprises you. She had assumed it was a no and asked anyway, which is what a team that talks to you looks like.",
            world: { staff: "trusting" },
          },
          {
            id: "c",
            text: "Ask what Friday is for, then see whether there's a version that works — because I said yes to the cause, not to the day.",
            consequence:
              "It is an appointment that moves. You swap her Friday for a Wednesday and it costs the rota nothing at all, which is the outcome nobody would have found by arguing.",
            world: { staff: "trusting" },
          },
        ],
      },
    },
  },

  "C8-HARD-01": {
    activityId: "C8-HARD-01",
    stage:
      "The delivery is in, and there is a bag on the counter end that you did not order: a kilo of the cheaper beans, with the invoice folded underneath it. The number on it would fix this month. Marcus is in his chair behind you, reading.",
    prompt: "Priya, holding the bag up to the light: “They've sent us a present, then.”",
    seed: [
      {
        id: "a",
        text: "Keep the beans we use and start telling people why — the roaster's name on the board, and the sourcing as part of what this place is.",
        consequence:
          "Priya writes the roaster and the farm above the menu in letters bigger than anything else on it. Three people ask about it in the first week.",
        world: { beans: "good", chalkboard: "beans_story" },
      },
      {
        id: "b",
        text: "Take the cheaper beans. The difference is real in a cupping room and nearly invisible under milk, and the margin keeps the lights on.",
        consequence:
          "You switch on the Monday. Nobody says anything for eleven days. On the twelfth, Marcus puts his cup down half finished and does not mention it.",
        world: { beans: "cheap", till: "healthy" },
      },
      {
        id: "c",
        text: "Stay with the beans we use, absorb the thinner margin this month, and say nothing about it to the customers or to the supplier.",
        consequence:
          "You pour the sample down the sink and put the invoice in the drawer. The month closes about four hundred short and the coffee tastes the way it did.",
        world: { beans: "good" },
      },
    ],
    follow: {
      a: {
        prompt:
          "The board is working — people are asking. Then the roaster puts their price up eight per cent, and you have just spent a month telling everyone their name.",
        choices: [
          {
            id: "a",
            text: "Pay it. I have put their name above the menu, and coming off them now makes the last month a story about nothing.",
            consequence:
              "You pay. The margin goes where the margin goes, and the name stays up, and two people that month say they came in because of it.",
            world: { beans: "good", chalkboard: "beans_story" },
          },
          {
            id: "b",
            text: "Go to them with what I've built — a month of naming them to everybody who walks in — and see what that is worth on the price.",
            consequence:
              "They come back with four per cent instead of eight and a bag of the new harvest. It turns out nobody else on their list had put the farm on a wall.",
            world: { beans: "good", chalkboard: "beans_story" },
          },
          {
            id: "c",
            text: "Find a roaster whose story I can tell just as honestly at a price that works, and be straight with people about the change.",
            consequence:
              "The new name goes up in December, and the old one comes down, and Priya writes both on the board for a fortnight so it does not look like a swap.",
            world: { beans: "good", chalkboard: "beans_story" },
          },
        ],
      },
      b: {
        prompt:
          "Three weeks on, Marcus asks — not unkindly, and not quietly, because the room is small — whether you have changed something about the coffee.",
        choices: [
          {
            id: "a",
            text: "Tell him straight that I switched and why, and let him decide what he thinks about it with the actual facts in front of him.",
            consequence:
              "He says “ah”, and then “fair enough”, and finishes it. He is in his chair the next morning at twenty to eight, the way he has been for years.",
            world: { beans: "cheap", regulars: "steady" },
          },
          {
            id: "b",
            text: "Say the roast is bedding in and switch back quietly next month, so nobody has to have a conversation about it at all.",
            consequence:
              "He nods and goes back to the paper. You switch back in November and nobody notices that either, which is either a relief or the whole problem.",
            world: { beans: "good" },
          },
          {
            id: "c",
            text: "Switch back today, and tell him I switched back today — the answer to being caught out is not a better answer.",
            consequence:
              "The good sack is open before eleven. He says nothing about any of it and drinks two, which is one more than usual.",
            world: { beans: "good", regulars: "steady" },
          },
        ],
      },
      c: {
        prompt:
          "The month closes short and the supplier calls to ask what you thought of the sample. Priya is at the machine and can hear every word of it.",
        choices: [
          {
            id: "a",
            text: "Tell him it wasn't for us and leave it there. He knows what he sent and I don't need to give him a lecture about it.",
            consequence:
              "The call is over in ninety seconds. Another bag arrives in February, unasked for, and goes in the same drawer as the invoice.",
            world: { beans: "good" },
          },
          {
            id: "b",
            text: "Tell him what it costs me to say no to it, and ask what he can actually do on the beans I do want to buy.",
            consequence:
              "He takes six per cent off the good ones for a quarter, which does not fix the month but fixes about a third of the next three.",
            world: { beans: "good", till: "healthy" },
          },
          {
            id: "c",
            text: "Say it out loud with Priya standing there — this is what we're not doing and this is what it cost us — so the team hears it once.",
            consequence:
              "She does not say anything at the time. Two weeks later you hear her tell a customer, unprompted and slightly wrongly, exactly why the coffee is what it is.",
            world: { beans: "good", staff: "trusting" },
          },
        ],
      },
    },
  },

  "C9-HARD-01": {
    activityId: "C9-HARD-01",
    stage:
      "A new café across the road, open a fortnight. Through two panes of glass you can see two of your regulars sitting in it. The four-top by the window is empty for the first time since you took this place on, and Priya has noticed you noticing.",
    prompt:
      "Three of the Tuesday lot were in there this morning. I'm not saying it to be cheerful.",
    seed: [
      {
        id: "a",
        text: "Cut prices while they're still deciding. Habit is the whole business at this size, and habit is cheapest to defend before it breaks.",
        consequence:
          "You take twenty pence off everything on the Monday. The Tuesday lot come back, and so does about a fifth less money for the same number of cups.",
        world: { rival: "open", till: "strained" },
      },
      {
        id: "b",
        text: "Stay steady. Ask the regulars what they actually come here for, and then put everything I have into that one thing.",
        consequence:
          "You ask nine people over a week. Six of them say some version of the same thing, and none of them mention coffee, which is not what you expected.",
        world: { rival: "open", regulars: "steady" },
      },
      {
        id: "c",
        text: "Treat it as information. Work out what the new place genuinely does well, work out what I do that they can't, and compete on that.",
        consequence:
          "You go in on a Thursday and buy a flat white. It is good, it is fast, and there is nowhere in it you could sit for an hour with a newspaper.",
        world: { rival: "open" },
      },
    ],
    follow: {
      a: {
        prompt:
          "They run an opening promotion the following week — free pastry with any coffee — and your twenty pence stops being visible at all.",
        choices: [
          {
            id: "a",
            text: "Go further. If we're competing on price then we compete on price properly, and half measures just cost me the margin twice.",
            consequence:
              "You go to a pound off a coffee-and-pastry. It is busy for eleven days and the takings for those eleven days are the worst of the autumn.",
            world: { till: "strained" },
          },
          {
            id: "b",
            text: "Put the prices back and say why, out loud, on the board — I'd rather be the place with a reason than the place with a discount.",
            consequence:
              "Priya chalks one line under the menu about what the coffee costs and why. Two people photograph it and one of them is somebody you have never seen before.",
            world: { rival: "promo", regulars: "steady" },
          },
          {
            id: "c",
            text: "Hold where I am and wait it out. Opening promotions end, and the people who came for one leave when the next one starts.",
            consequence:
              "It ends after five weeks. About half of the people who went come back, and the ones who do not were never at the four-top anyway.",
            world: { rival: "promo", regulars: "steady" },
          },
        ],
      },
      b: {
        prompt:
          "What they say they come for is the chair by the window, and Marcus, and being able to sit for an hour. None of which is on the menu.",
        choices: [
          {
            id: "a",
            text: "Build the room around that — more of the tables, fewer of the takeaway cups, and stop pretending we're competing on speed.",
            consequence:
              "The high two-top goes and a second four-top comes in. It is fuller by December than the first one was in September, and the mornings are slower.",
            world: { regulars: "returning" },
          },
          {
            id: "b",
            text: "Note it and carry on. It's a nice thing to hear, but nine people is nine people and I can't rebuild a café on that.",
            consequence:
              "You carry on. Two of the nine stop coming in over the winter and you do not find out why, because you do not ask again.",
            world: { regulars: "steady" },
          },
          {
            id: "c",
            text: "Ask the people who left the same question, because the nine who stayed can only tell me half of what I need to know.",
            consequence:
              "Four of them answer. Three say it is the seven o'clock opening and one says the chairs, which is the opposite of what the nine said, and both are true.",
            world: { regulars: "steady" },
          },
        ],
      },
      c: {
        prompt:
          "You know what they are: fast, bright, and no good for sitting in. Then they put tables outside, and the weather turns fine for a fortnight.",
        choices: [
          {
            id: "a",
            text: "Match them and put tables out too. The pavement's there, the licence isn't hard, and I'm not handing them the good fortnight.",
            consequence:
              "You get three tables out by the second week. They are full on the fine days and in the way on all the others, and the licence took a month.",
            world: { rival: "promo" },
          },
          {
            id: "b",
            text: "Stay with what I worked out. A fortnight of weather isn't a change in what they are, and I'd be rebuilding around a forecast.",
            consequence:
              "It rains from the eighteenth. Their tables come in, yours were never out, and the four-top has three people at it on a Tuesday for the first time since August.",
            world: { regulars: "returning" },
          },
          {
            id: "c",
            text: "Take the part of it that fits — somewhere to sit outside for ten minutes — without turning this into a pavement café.",
            consequence:
              "Two stools and a shelf by the window, inside the door. It costs about forty pounds and it is the thing people mention when they mention the room.",
            world: { regulars: "returning" },
          },
        ],
      },
    },
  },
};

/**
 * Both seasons, in one lookup. Nothing that plays a beat needs to know which
 * track it is on — it has an activity id, and the ids are distinct across the
 * eighteen rows, so the tree for a decision is a plain map read either way.
 */
export const TREES: Readonly<Record<string, Tree>> = { ...HARD_TREES, ...PRO_TREES };

export function treeFor(activityId: string): Tree | null {
  return TREES[activityId] ?? null;
}
