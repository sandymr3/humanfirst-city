// The Level B decision content — nine more trees, nine leaves each.
//
// Same rules as trees.ts and the same absence of tiers. What changes is the
// weight (PRD §14): in Level A one pressure arrives at a time and the horizon is
// short; here every option has a defensible case and a real price, and **the
// follow-up is where the price arrives**. That is the whole design of this file
// — the seed layer asks what you would do, and the follow-up hands you the bill
// for having done it, without ever telling you whether the bill was fair.
//
// Seed layers marked *§9.5* are the PRD's shipping text. Follow-up prompts and
// leaves are authored against it, held to the same parity gates in
// trees.test.ts: 13–33 words, no trio spread over 8, every option carrying its
// own reasoning, and no line doing service twice anywhere in either season.
import type { Tree } from "./trees";

export const PRO_TREES: Readonly<Record<string, Tree>> = {
  // C1 · empathy_pain. The Advanced path is finding out what the request
  // actually costs the person asking — which is why every branch here ends up
  // somewhere other than "did you stock it".
  "C1-SCB-01": {
    activityId: "C1-SCB-01",
    stage:
      "8:05, and you have stood behind a counter at this hour before. Nadia is already reaching for her card. Tomas is on the bar because Priya cannot do six mornings, and you can hear him not quite keeping up behind you.",
    prompt: "You still don't do oat, do you? I'm not having a go. I plan my morning round it now.",
    seed: [
      {
        id: "a",
        text: "Ask her what she actually does on the mornings we can't serve her, and how far out of her way it takes, before I order a single crate.",
        consequence:
          "She tells you she goes to the station café three mornings a week. Nine minutes out of her way, both directions, and she has never mentioned it because nobody ever asked her.",
        world: { regulars: "thin" },
      },
      {
        id: "b",
        text: "Order oat and almond for Thursday, because six people have asked in a fortnight and in a room this size that is a queue already forming somewhere else.",
        consequence:
          "Two crates land Thursday. The oat goes. Six weeks later the almond is behind the milk fridge, unopened, and Nadia is still not in on the mornings she is not in.",
        world: { chalkboard: "oat_plus", till: "tight" },
      },
      {
        id: "c",
        text: "Chalk a card by the till and count for two days, since I would rather order against a number than against whichever three customers happen to be loudest.",
        consequence:
          "Eleven ticks in two days, nine of them before half eight. They are not the people you would have guessed, and one of them is somebody Tomas serves every Tuesday.",
        world: { chalkboard: "oat_asked" },
      },
    ],
    follow: {
      a: {
        prompt:
          "Nine minutes each way, three mornings a week, for a coffee. She has been doing it since March and she is not the only one.",
        choices: [
          {
            id: "a",
            text: "Order the oat and tell her by name before it goes on the board, because the person who told you is the person who should hear it first.",
            consequence:
              "You tell her on the Thursday. She is back in on the Friday, and the week after that she brings the one from the office who had also stopped coming.",
            world: { chalkboard: "oat", regulars: "returning" },
          },
          {
            id: "b",
            text: "Order the oat and start asking the same question of everybody who orders something we nearly don't do, since one answer is an anecdote.",
            consequence:
              "You ask it eleven times in a fortnight and write the answers on the back of the rota. Two of them are about opening times and have nothing to do with milk.",
            world: { chalkboard: "oat" },
          },
          {
            id: "c",
            text: "Order the oat, and work out what else in this room is costing somebody nine minutes that nobody has thought to mention to us.",
            consequence:
              "The oat goes on. You spend a fortnight noticing that the queue at the till bends round the pastry case, and that three people a morning leave rather than join it.",
            world: { chalkboard: "oat" },
          },
        ],
      },
      b: {
        prompt:
          "The oat moves and the almond does not, and the crate you are still paying for is behind the fridge. Priya has not said anything about it, which is Priya saying something.",
        choices: [
          {
            id: "a",
            text: "Drop the almond, write the crate off, and say out loud that I bought it on a show of hands rather than on anything I had measured.",
            consequence:
              "You say it at the Monday handover, briefly, and nobody makes anything of it. Priya starts bringing you the docket numbers without being asked from the following week.",
            world: { chalkboard: "oat", staff: "trusting" },
          },
          {
            id: "b",
            text: "Keep the almond on until the quarter ends, because a range that changes every fortnight tells people this place has not decided what it is.",
            consequence:
              "It stays on the board until December. Nobody orders it and nobody comments on it, and you throw away rather more of it than you would like to write down.",
            world: { till: "tight" },
          },
          {
            id: "c",
            text: "Ask the six who asked what they would actually order now it is in, and let their answers decide which of the two stays.",
            consequence:
              "Four of the six say oat without hesitating. The other two say they had asked on behalf of somebody who has since stopped coming in, which is its own piece of information.",
            world: { chalkboard: "oat" },
          },
        ],
      },
      c: {
        prompt:
          "Eleven ticks, nine of them before half eight, and two names you do not recognise. Tomas says one of them asks him every Tuesday and he has been saying no.",
        choices: [
          {
            id: "a",
            text: "Order for the morning window specifically, and tell Tomas the Tuesday one is his to answer, since he is the one who has been fielding it.",
            consequence:
              "Tomas tells her himself on the Tuesday. She is in the following Tuesday with somebody else, and he mentions it to you in a way that is almost casual.",
            world: { chalkboard: "oat", staff: "trusting" },
          },
          {
            id: "b",
            text: "Order it and leave the card up, because two days of ticks is a start and the next fortnight is what tells us whether it holds.",
            consequence:
              "The card stays up three weeks and collects nineteen more ticks, most of them from the same eleven people. It holds, and now you know what holding looks like here.",
            world: { chalkboard: "oat" },
          },
          {
            id: "c",
            text: "Go and ask the two names what they do on the mornings we cannot serve them, since a tick is a preference and not a cost.",
            consequence:
              "One of them shrugs and says she just has tea instead. The other one names the station café and the exact walk, and you order that afternoon.",
            world: { chalkboard: "oat", regulars: "steady" },
          },
        ],
      },
    },
  },

  // C2 · experimentation. Both tracks turn on whether the test was designed or
  // improvised; here it turns on whether it was designed *before or after the
  // data*, which is the deepest form of it and the thing the follow-up exists
  // to catch (§9.5).
  "C2-SCB-01": {
    activityId: "C2-SCB-01",
    stage:
      "The iced drink has been on three weeks because you told the team to get behind it. Tomas rewrote the board for it on a Monday. Priya has the dockets folded in her apron and has not offered them.",
    prompt: "Do you want the numbers, or do you want to leave it another week?",
    seed: [
      {
        id: "a",
        text: "Run one clean test: change a single variable, measure it, and decide the keep-or-cut threshold before you look at the result.",
        consequence:
          "You put the price up forty pence for a week and write the cut-off on the docket before Friday. It clears the line by two cups, and nobody has to argue about what that means.",
        world: { staff: "trusting" },
      },
      {
        id: "b",
        text: "Hold the line. Reversing a fortnight after you asked the team to commit teaches them that your decisions are weather.",
        consequence:
          "You leave it another three weeks. It stays flat. Tomas stops rewriting the board on Mondays, and when the chalk runs out nobody replaces it.",
        world: { staff: "strained" },
      },
      {
        id: "c",
        text: "Put the numbers on the counter in front of the team, ask them why they think it's missing, and change it on what they say.",
        consequence:
          "Priya says it is too sweet and Tomas says nobody knows what it is called. You change both in the same week, it lifts a fifth, and you cannot say which one did it.",
        world: { chalkboard: "iced_renamed" },
      },
    ],
    follow: {
      a: {
        prompt:
          "It cleared the threshold by two cups, which is inside anything you would honestly call noise. Priya asks, not unkindly, whether two cups is a result.",
        choices: [
          {
            id: "a",
            text: "Run it again for a fortnight at the same price, because a threshold set honestly is worth nothing if you stop at the first number that clears it.",
            consequence:
              "The fortnight comes in at eleven cups over. You put the price change in permanently, and Priya writes the new number on the board without asking you first.",
            world: { chalkboard: "iced_renamed", staff: "trusting" },
          },
          {
            id: "b",
            text: "Call it and move on. The threshold was set before the data and the data cleared it, which is the whole discipline.",
            consequence:
              "You keep the price and move on to the pastry case. Six weeks later the drink is flat again and you have no way of telling whether it ever was not.",
            world: { chalkboard: "iced" },
          },
          {
            id: "c",
            text: "Widen it to the early hours instead, since two cups over one week is a question about how much you measured rather than about the drink.",
            consequence:
              "You run it across the morning window as well. The lift is entirely in the after-two trade, which is a thing about this street you did not previously know.",
            world: { chalkboard: "iced" },
          },
        ],
      },
      b: {
        prompt:
          "Three more weeks, still flat, and the board has not been rewritten since the Monday Tomas gave up on it. Nobody has said anything to you about any of it.",
        choices: [
          {
            id: "a",
            text: "Cut it, and say in front of everyone that I asked them to back something I had not tested, so that the next ask means something.",
            consequence:
              "You say it at handover. Tomas asks, immediately and without any edge, what you want to try next, which is not the reaction you had braced for.",
            world: { staff: "trusting", chalkboard: "iced" },
          },
          {
            id: "b",
            text: "Cut it quietly over the weekend and put something else up, because a drink nobody orders does not need a post-mortem in front of the team.",
            consequence:
              "It is gone by Monday and nobody mentions it. Nobody suggests anything for the space it left, either, and the board stays as it is until October.",
            world: { staff: "strained" },
          },
          {
            id: "c",
            text: "Give it the summer. Three flat weeks in April tells you about April, and a cold drink was always going to live or die in July.",
            consequence:
              "It picks up in the last week of June and holds through August. You never do find out whether that was the drink or the weather, and you stop trying to.",
            world: { chalkboard: "iced" },
          },
        ],
      },
      c: {
        prompt:
          "It lifted about a fifth, and you changed the recipe and the name in the same week. Tomas asks which one worked, and he is not being difficult.",
        choices: [
          {
            id: "a",
            text: "Say that I do not know, put the old name back for a fortnight at the new recipe, and actually find out.",
            consequence:
              "The fortnight says it was the recipe. The name goes back to the new one anyway because Tomas prefers it, and everybody knows which part of that was measured.",
            world: { chalkboard: "iced_renamed", staff: "trusting" },
          },
          {
            id: "b",
            text: "Take the lift. A fifth is a fifth, and unpicking a result going your way is how you talk yourself out of a good week.",
            consequence:
              "You bank it. In September it drops back and the argument about which change to undo takes three handovers and does not resolve.",
            world: { staff: "strained" },
          },
          {
            id: "c",
            text: "Write down what happened, including that I ran two changes at once, and set the rule now for the next thing we try.",
            consequence:
              "The rule goes on the inside of the stockroom door: one change, one week, threshold first. It is still there in December, with two more lines under it in Priya's hand.",
            world: { staff: "trusting" },
          },
        ],
      },
    },
  },

  // C3 · smart_vs_reckless_risk. §9.5: "stress-test the worst case, then
  // commit." Seed layer is the PRD's shipping text.
  "C3-SCB-01": {
    activityId: "C3-SCB-01",
    stage:
      "The letter has been on the hatch a week. Ray comes in with the folder rather than the truck: thirty per cent off a quarter's beans, placed today, back to list on Monday. The saving is real and it is most of your spare cash.",
    prompt:
      "It's a real number, I'm not going to pretend it isn't. But you'd be paying me now for coffee you'll be drinking in November.",
    seed: [
      {
        id: "a",
        text: "Pass. Tying that much cash to a forecast you don't have is the kind of risk that only looks smart in hindsight.",
        consequence:
          "You pass. Ray shrugs and takes the folder back out to the van. In November the price is exactly where he said it would be and you pay it without much feeling about it.",
      },
      {
        id: "b",
        text: "Model your worst-case cash position honestly. If you'd survive it, take the whole deal and lock the saving in.",
        consequence:
          "You write a bad November on the back of the invoice and it still leaves you standing, so you take the lot. The stockroom is full and the account very much is not.",
        world: { till: "strained", beans: "good" },
      },
      {
        id: "c",
        text: "Take a smaller order now with an option on the rest later — most of the discount, a fraction of the exposure.",
        consequence:
          "You take a third with first refusal on the rest. Ray writes it on the folder in biro and initials it, which is as close to a contract as this ever gets.",
        world: { till: "tight" },
      },
    ],
    follow: {
      a: {
        prompt:
          "Two months on the roaster has put the price up again, and Ray mentions, without meaning anything by it, that two other places took the deal.",
        choices: [
          {
            id: "a",
            text: "Ask him what the next one looks like and get the date in the diary, so the answer is a decision rather than a reaction.",
            consequence:
              "He gives you a date in February and a rough number. You spend January working out what you would need to be true to say yes to it.",
          },
          {
            id: "b",
            text: "Pass again. The reason it was wrong in September has not changed just because the number went the way it went.",
            consequence:
              "You pass. The margin is thinner all quarter and the account is untouched, and the two places that took it are still open, which tells you nothing either way.",
            world: { till: "tight" },
          },
          {
            id: "c",
            text: "Say plainly that I said no because I could not model it, and ask him to bring me the numbers three weeks earlier next time.",
            consequence:
              "Ray says nobody has ever asked him that. The next offer arrives three weeks ahead with the previous year's volumes attached, unprompted.",
          },
        ],
      },
      b: {
        prompt:
          "October comes in a fifth worse than your bad-October number. The reserve holds and is visibly draining, and there is a quarter of beans in the stockroom that will not turn back into cash.",
        choices: [
          {
            id: "a",
            text: "Tell Priya how many weeks the reserve covers at this rate, and then trim everything that is not hours or coffee.",
            consequence:
              "You give her the number. She takes the linen contract down to fortnightly the same afternoon and finds two more things you had not thought of.",
            world: { staff: "trusting" },
          },
          {
            id: "b",
            text: "Sell a third of the stock on to the place by the station at cost, since cash I can spend beats beans I cannot.",
            consequence:
              "They take it and pay inside a week. You have lost the discount on that third and you have a month of breathing room, and both of those are true at once.",
            world: { till: "tight" },
          },
          {
            id: "c",
            text: "Hold. The stock is bought and the saving is real, and panicking a fifth of the way into a bad month is how you turn one into three.",
            consequence:
              "You hold. November comes in ahead of October and the reserve stops draining in the third week, and there is a fortnight in there you would not want to live through twice.",
            world: { till: "strained" },
          },
        ],
      },
      c: {
        prompt:
          "The option expires Friday. The first third has been fine and the quarter after next is exactly as unclear as it was in September.",
        choices: [
          {
            id: "a",
            text: "Take the second third and let the last one go, because the reasoning that got me here has not stopped being true this week.",
            consequence:
              "Ray initials it again. You are two thirds in at most of the discount, and the number that would have hurt you is a number you never wrote.",
            world: { beans: "good" },
          },
          {
            id: "b",
            text: "Take the rest. Two months of it going fine is data, and an option you never exercise is a discount you talked yourself out of.",
            consequence:
              "The stockroom fills. February is slower than either of you expected and there are still four sacks on the top shelf in March, going quietly past their best.",
            world: { till: "strained" },
          },
          {
            id: "c",
            text: "Let it expire and ask Ray to price a standing monthly order instead, so I stop making this same decision four times a year.",
            consequence:
              "He comes back with a monthly number that is worse than thirty per cent and better than list. You sign it, and the folder stops appearing on your counter.",
            world: { beans: "good" },
          },
        ],
      },
    },
  },

  // C4 · cash_flow. Fully worked in PRD §9.4 — seed and all three follow-up
  // branches are that section's text, with the leaf consequences authored to it.
  "C4-SCB-01": {
    activityId: "C4-SCB-01",
    stage:
      "22:30. Chairs up, machine cooling and ticking as it goes. One pendant on over the till. The month's takings are stacked on the counter in front of you — the best four weeks since you took the place on. It is also August, and you have run a room long enough to know what September looks like.",
    prompt: "The best four weeks since you took it on, and it is the twenty-ninth of August.",
    seed: [
      {
        id: "a",
        text: "Treat the month as weather, not climate. Work out what this place costs to run through a bad October, ring-fence exactly that, and invest only what could vanish without touching anyone's wages.",
        consequence:
          "You write two numbers on the back of a receipt: what a bad October costs, and what is left over. The second number is small. You spend it on the grinder, which was going anyway, and go home.",
        world: { till: "healthy" },
      },
      {
        id: "b",
        text: "Cover the slow stretch first — a realistic number, not a comfortable one — then put whatever's left behind the single thing that earns the most back.",
        consequence:
          "You take last year's slow-season number, add a fifth, and put it aside. What is left goes on the loyalty cards Priya has been asking about for a year. It is the kind of decision nobody ever notices.",
        world: { till: "healthy", staff: "trusting" },
      },
      {
        id: "c",
        text: "Put it to work while it's working. Momentum is the hardest thing to buy and the easiest thing to lose; a good month is when you extend, not when you sit on it.",
        consequence:
          "You commit to the second machine and the extra weekend hours. For three weeks it feels like exactly what the month was for. Then the schools go back, the mornings thin, and you are carrying a payment on a machine that is cold by eleven.",
        world: { till: "strained", machine: "upgraded" },
      },
    ],
    follow: {
      a: {
        prompt:
          "October comes in worse than your bad-October number — not catastrophically, about a fifth worse. The reserve holds, but it is visibly draining, and Priya has started asking, carefully, whether her hours are safe.",
        choices: [
          {
            id: "a",
            text: "Tell her the truth with a number in it: how many weeks the reserve covers at this rate. Then trim what can be trimmed without touching hours.",
            consequence:
              "You say eleven weeks and watch her decide to believe you. She brings you three costs by Friday, two of which you did not know were still going out.",
            world: { staff: "trusting" },
          },
          {
            id: "b",
            text: "Reassure her it's fine and keep the number to yourself until you have to share it. Worrying the team about a month that might still turn is its own kind of damage.",
            consequence:
              "You tell her it is fine. It is nearly fine. She asks again in November, differently, and the second conversation is harder than the first one would have been.",
            world: { staff: "strained" },
          },
          {
            id: "c",
            text: "Say plainly how far the reserve goes — then give October a job. Use the quiet mornings for the 7:50 window you've never had time to fix.",
            consequence:
              "The mornings get rebuilt in a month you would otherwise have spent worrying. By December the 7:50 window is twenty per cent up on the year before.",
            world: { staff: "trusting", regulars: "steady" },
          },
        ],
      },
      b: {
        prompt:
          "October undershoots your reserve by about a fortnight's worth. The loyalty cards are working — but slowly, and slowly is not what a fortnight short needs.",
        choices: [
          {
            id: "a",
            text: "Push the loyalty scheme harder. Double the stamps for a month and buy the traffic back while there's still a scheme to push.",
            consequence:
              "Traffic comes back and so does the cost of it. In January the stamps go back to normal and about a third of the people you bought do not.",
            world: { till: "tight" },
          },
          {
            id: "b",
            text: "Separate the two problems. Fund the fortnight from something reversible, and let the loyalty scheme run on its own timeline instead of asking it to rescue you.",
            consequence:
              "You take a short overdraft you clear by December. The cards keep doing what cards do, which is slowly, and by March they are the reason the mornings are steady.",
            world: { till: "healthy" },
          },
          {
            id: "c",
            text: "Trim a fortnight of hours by agreement, close an hour earlier on the dead days, and protect the reserve rather than the schedule.",
            consequence:
              "Everyone agrees to it and nobody enjoys it. The reserve holds, and the six o'clock closes stay after the reason for them has gone.",
            world: { staff: "strained", till: "healthy" },
          },
        ],
      },
      c: {
        prompt:
          "The machine payment lands on the 3rd. The takings don't. For the first time since you took this place on, you are short.",
        choices: [
          {
            id: "a",
            text: "Name it out loud, to Priya and to the supplier, before either works it out alone — then restructure the payment while you still have credibility to spend.",
            consequence:
              "Both take it better than you expected and the supplier moves you onto six months. Priya says she had already worked it out, and had been waiting to see whether you would say it.",
            world: { staff: "trusting", till: "strained" },
          },
          {
            id: "b",
            text: "Go to the supplier for terms and cut every single cost that isn't the coffee or the wages. This week, not next month.",
            consequence:
              "Eleven things go in four days. The room looks the same and costs a fifth less to run, and two of the eleven you never do put back.",
            world: { till: "tight" },
          },
          {
            id: "c",
            text: "Trade through it. A tight month is a tight month, and the machine pays for itself the moment the mornings come back.",
            consequence:
              "The mornings come back in the third week of November, which is five weeks after the payment did. You get through it and you do not want to describe how.",
            world: { till: "strained" },
          },
        ],
      },
    },
  },

  // C5 · scenario_thinking. "Today's call shapes the next two years" is the
  // definition (§10.1), and the follow-ups are the two years arriving.
  "C5-SCB-01": {
    activityId: "C5-SCB-01",
    stage:
      "A card on the community board you did not pin, and forty per cent of last month's orders behind it. The commission letter came Tuesday. Whatever you settle today you will be living inside for two years.",
    prompt: "I still order through the app. Is that bad? You've gone quiet about it.",
    seed: [
      {
        id: "a",
        text: "Absorb it. You cannot walk away from forty per cent of your orders on principle, and a thinner margin is still a margin.",
        consequence:
          "You take the new rate. The orders keep coming, the margin on them is thinner than the ones you make yourself, and by December you have stopped doing that arithmetic.",
        world: { board: "app_card" },
      },
      {
        id: "b",
        text: "Renegotiate, or price the app channel separately, and start nudging the people who come back anyway toward ordering direct.",
        consequence:
          "You put the app prices up eight per cent and print your number on every bag. Nobody complains about the price, and about one bag in nine comes back as a direct order.",
        world: { board: "direct_card", chalkboard: "app" },
      },
      {
        id: "c",
        text: "Build the direct channel properly, so no single platform is ever again in a position to reprice forty per cent of me.",
        consequence:
          "It takes six weeks and the app volume drops while you build it. By spring a third of your orders come through your own door, and none of those are anyone else's to reprice.",
        world: { board: "direct_card" },
      },
    ],
    follow: {
      a: {
        prompt:
          "They raise it again in March, by less, and the letter is otherwise the same letter. Priya asks what happens the third time.",
        choices: [
          {
            id: "a",
            text: "Give her the honest answer, which is that I have no lever at all, and start building one before the next letter comes.",
            consequence:
              "You say it out loud and it sounds worse than it did in your head. The direct list starts that week and has four hundred names on it by August.",
            world: { board: "direct_card" },
          },
          {
            id: "b",
            text: "Absorb it again and keep quiet, because announcing that you have no leverage inside your own shop is how you lose the room.",
            consequence:
              "Nobody hears it from you. Tomas works it out from the invoices in April and tells Priya, and you find out that they know from how carefully neither of them mentions it.",
            world: { staff: "strained" },
          },
          {
            id: "c",
            text: "Put the app prices up to cover it, and stop pretending that the two channels are the same business.",
            consequence:
              "The app prices go up nine per cent overnight. Volume dips for a fortnight and comes back, and the margin on it stops being something you avoid looking at.",
            world: { chalkboard: "app" },
          },
        ],
      },
      b: {
        prompt:
          "One bag in nine is real and it is slow. The app has noticed the separate pricing and has asked you, politely, to stop.",
        choices: [
          {
            id: "a",
            text: "Keep the pricing and tell them why, because a channel that costs more to serve should cost more, and that is not a position I need to hide.",
            consequence:
              "They push back twice and then stop. Two other places on the street do the same thing within the quarter, and one of them tells you it was because you had.",
            world: { board: "direct_card" },
          },
          {
            id: "b",
            text: "Drop the separate pricing and put everything into the bag inserts instead, since one in nine is the number that is actually moving.",
            consequence:
              "The inserts get better and the ratio goes to one in seven. The margin on the app orders stays where it was, which is where it was.",
            world: { board: "direct_card" },
          },
          {
            id: "c",
            text: "Ask what they will give me for dropping it, and find out whether that letter was a rate or an opening.",
            consequence:
              "It was an opening. You come out with three months at the old commission, which is less than you wanted and considerably more than nothing.",
            world: { board: "app_card" },
          },
        ],
      },
      c: {
        prompt:
          "A third of your orders are your own now, and the app has started promoting the place across the road inside your own postcode.",
        choices: [
          {
            id: "a",
            text: "Come off the app entirely, and tell the direct list why in one sentence on the day I do it.",
            consequence:
              "You lose about a fifth of the total overnight and get half of it back by June. The sentence gets forwarded around the neighbourhood rather more than you meant it to be.",
            world: { board: "direct_card", regulars: "steady" },
          },
          {
            id: "b",
            text: "Stay on at the lower volume, because a channel that finds you new people is worth a cut even when it is also finding them for somebody else.",
            consequence:
              "You stay. The app sends you eleven new names a month and sends the place opposite rather more, and both of those things go on being true.",
            world: { rival: "promo" },
          },
          {
            id: "c",
            text: "Match their promotion on my own channel and find out who my regulars are actually loyal to before I decide anything permanent.",
            consequence:
              "You run it for three weeks. The direct list outspends the app list by a third, and you now know something about this street that no platform is going to tell you.",
            world: { board: "direct_card" },
          },
        ],
      },
    },
  },

  // C6 · negotiation. Level A is a discount; here it is a year, a signature and
  // somebody who genuinely has other options.
  "C6-SCB-01": {
    activityId: "C6-SCB-01",
    stage:
      "She has taken Marcus's table again, and this time there is a contract in the folder. A year's commitment, forty covers a week, and terms that would leave you working at roughly nothing.",
    prompt:
      "I should say we're also talking to the place by the station. That isn't a threat, it's just where we are.",
    seed: [
      {
        id: "a",
        text: "Meet the terms. Predictable revenue at a thin margin still beats an empty diary, and an empty diary is what December looks like.",
        consequence:
          "You sign. Forty covers land every Tuesday and Thursday, the margin on them is a rounding error, and Priya is on for both days whether the room needs her or not.",
        world: { till: "tight", staff: "strained" },
      },
      {
        id: "b",
        text: "Hold the price and give ground on what costs me least — delivery windows, packaging, invoicing — and let them choose.",
        consequence:
          "You hold your number and give them the eight o'clock slot and their own boxes. They take it, and the woman who signs says she had expected to spend longer on this.",
        world: { till: "healthy" },
      },
      {
        id: "c",
        text: "Find out what they actually value, rebuild the deal around that, and be genuinely willing to walk away from it.",
        consequence:
          "It turns out they do not care about the price at all. They care that it arrives before the nine-fifteen. You rebuild it round that and the number barely moves.",
        world: { till: "healthy", staff: "trusting" },
      },
    ],
    follow: {
      a: {
        prompt:
          "Three months in they ask for the same terms on a second site. Priya is doing six days and Marcus's table has been theirs every Tuesday since April.",
        choices: [
          {
            id: "a",
            text: "Say no to the second site and reprice the first at renewal, because I signed a number I now know to be wrong.",
            consequence:
              "They take the no better than you expected and the renewal goes up eleven per cent. Marcus gets his Tuesday back in the same conversation, which nobody planned.",
            world: { till: "healthy", regulars: "returning" },
          },
          {
            id: "b",
            text: "Take it. Two sites at a thin margin is still the only revenue in this building I can predict a month out.",
            consequence:
              "The second site starts in January. By March you are making eighty covers a week at a number you cannot look at, and Priya has stopped offering to do Saturdays.",
            world: { staff: "strained", till: "tight" },
          },
          {
            id: "c",
            text: "Take it, and put the whole account behind one delivery run so the cost of serving it stops landing on the floor.",
            consequence:
              "One van, one run, one morning. The margin comes back about half of the way and the Tuesday queue stops being something people mention.",
            world: { till: "healthy" },
          },
        ],
      },
      b: {
        prompt:
          "They come back in October wanting the eight o'clock moved to half seven, which is before Priya starts and after you have run out of goodwill about it.",
        choices: [
          {
            id: "a",
            text: "Price the earlier slot properly, and let them decide whether half seven is worth what half seven actually costs me.",
            consequence:
              "You put a number on it. They think about it for a week and stay at eight, and the conversation about time never has to be a conversation about loyalty.",
            world: { till: "healthy" },
          },
          {
            id: "b",
            text: "Do it, and take the early run myself for a month until I know what it really costs to serve.",
            consequence:
              "Four weeks of half sixes. You come out of it knowing the number exactly, and knowing you cannot do it for a fifth week without something else giving.",
            world: { staff: "strained" },
          },
          {
            id: "c",
            text: "Say no to half seven and offer the night before instead, since the thing they actually need is it being there.",
            consequence:
              "They take the night before without arguing. It costs you a fridge shelf and nothing else, and it turns out nobody had ever asked them what the time was for.",
            world: { till: "healthy" },
          },
        ],
      },
      c: {
        prompt:
          "The nine-fifteen holds all year. In March a new buyer takes the account over and asks, pleasantly, for fifteen per cent.",
        choices: [
          {
            id: "a",
            text: "Take her through what the last one cared about, and find out whether fifteen per cent is what she actually needs.",
            consequence:
              "She needs a single invoice a month rather than a discount. You give her that and keep the price, and she says her predecessor had never mentioned it.",
            world: { till: "healthy" },
          },
          {
            id: "b",
            text: "Give her the fifteen. Losing a year-old account over a number I can absorb is an expensive way to be right.",
            consequence:
              "She takes it in about four minutes and asks for eighteen in September. You now have a price that moves whenever the person holding the folder changes.",
            world: { till: "tight" },
          },
          {
            id: "c",
            text: "Hold, and remind her what the nine-fifteen is worth, because the deal was built round that rather than round the price.",
            consequence:
              "She holds too, for six weeks, and then signs at the old number. Neither of you mentions it again and the delivery keeps going out at ten past.",
            world: { till: "healthy" },
          },
        ],
      },
    },
  },

  // C7 · feedback. The mechanism is the honest conversation, held or avoided —
  // and on this track the person it is about is the one keeping the room open.
  "C7-SCB-01": {
    activityId: "C7-SCB-01",
    stage:
      "First grey day. Tomas is the fastest pair of hands you have and the reason two other people have started swapping shifts to avoid him. The rota by the hatch has been rewritten twice this fortnight, and not by you.",
    prompt: "You've seen it. I'm not going to keep rewriting the rota round it.",
    seed: [
      {
        id: "a",
        text: "Back the performer. Results carry a small business, and the rest of the team adjusts to reality faster than they admit.",
        consequence:
          "You leave it. The bar is fast all quarter and the rota keeps getting rewritten, and in November the one who has been swapping shifts hands you four weeks' notice instead.",
        world: { staff: "strained", regulars: "steady" },
      },
      {
        id: "b",
        text: "Deal with the behaviour directly with him, and protect morale by being open with everybody else about what I'm doing.",
        consequence:
          "You have it out by the hatch and then say at handover exactly what you have asked of him, and nothing about why. The floor is careful for a fortnight and then it is normal.",
        world: { staff: "trusting" },
      },
      {
        id: "c",
        text: "Set one standard that applies to everybody, coach him toward it, and accept that holding it might cost me him.",
        consequence:
          "You write the standard down and it applies to Priya too, which she notices out loud. Tomas is a fortnight of very cold politeness and then, unexpectedly, better.",
        world: { staff: "trusting" },
      },
    ],
    follow: {
      a: {
        prompt:
          "The notice is on your desk. Tomas asks, without much interest either way, whether he is picking up those shifts.",
        choices: [
          {
            id: "a",
            text: "Say no, tell him exactly why those shifts came free, and have the conversation I should have had in September.",
            consequence:
              "He is quiet for most of it and then says he had assumed you did not mind. Neither of you enjoys the afternoon and the rota stops moving.",
            world: { staff: "trusting" },
          },
          {
            id: "b",
            text: "Give him the shifts. The room has to open, and I will deal with the cause once I have somebody on the bar.",
            consequence:
              "He covers everything and the bar is fast and the cause is still there in February, by which point it is simply how this place works.",
            world: { staff: "strained" },
          },
          {
            id: "c",
            text: "Split them across everybody and start the standard now, so the next person leaving is not leaving for the same reason.",
            consequence:
              "Three people take a shift each. The standard goes on the stockroom door and the second resignation you were braced for does not arrive.",
            world: { staff: "trusting" },
          },
        ],
      },
      b: {
        prompt:
          "He holds it for six weeks and then slips badly on a Saturday you are not in. Priya tells you on the Monday, and tells you she nearly did not.",
        choices: [
          {
            id: "a",
            text: "Thank her for telling me, and then go back to him with the same standard and the same tone as the first time.",
            consequence:
              "The second conversation is shorter than the first and lands harder. He does not slip again that quarter, and Priya tells you the next thing without the preamble.",
            world: { staff: "trusting" },
          },
          {
            id: "b",
            text: "Ask what stopped her nearly telling me, because that is the part of this that will still be here after Tomas is not.",
            consequence:
              "She says she did not want to be the one who ended it. You spend the rest of the conversation on that instead, and it is the more useful one.",
            world: { staff: "trusting" },
          },
          {
            id: "c",
            text: "Let this one go and watch for the next, since one Saturday six weeks in is not yet a pattern worth spending on.",
            consequence:
              "There is another one in three weeks and a third the week after. By the time you raise it, it is a conversation about three things rather than one.",
            world: { staff: "strained" },
          },
        ],
      },
      c: {
        prompt:
          "He is better and he is slower, and the queue at half eight is four deep in a way it was not in September.",
        choices: [
          {
            id: "a",
            text: "Hold the standard and fix the queue, because those are two problems and only one of them is about him.",
            consequence:
              "You move the pastry case and put the card reader on the other end. The queue halves inside a week and the standard never comes up again.",
            world: { staff: "trusting", regulars: "steady" },
          },
          {
            id: "b",
            text: "Tell him plainly that the standard stays and the speed has to come back, and then ask him what would help.",
            consequence:
              "He says a second grinder, which you already knew, and a Saturday he can plan round, which you did not. You give him the second one.",
            world: { staff: "trusting" },
          },
          {
            id: "c",
            text: "Put him back on the machine at the peak and take the till myself, and stop asking one person to be both.",
            consequence:
              "The half eight goes back to what it was. You are on the till five mornings a week now, which is fine until the week you are not in.",
            world: { staff: "easy" },
          },
        ],
      },
    },
  },

  // C8 · quality_craftsmanship. The decision is literally about the product, and
  // the follow-up is the product being noticed by the one person who would.
  "C8-SCB-01": {
    activityId: "C8-SCB-01",
    stage:
      "The sample is on the counter end with the invoice folded underneath it. There is a reduction here that this quarter needs and almost nobody would notice for a while. Marcus is in his chair behind you, reading.",
    prompt: "It's fine under milk. I'm not saying take it. I'm saying it's fine under milk.",
    seed: [
      {
        id: "a",
        text: "Make it. The numbers need it, the difference is marginal, and a quarter you survive is worth more than a principle you can't afford.",
        consequence:
          "The cheaper sacks come in Thursday and nobody says a word for five weeks. In the sixth, Marcus puts his cup down half full and does not mention that either.",
        world: { beans: "cheap", regulars: "steady" },
      },
      {
        id: "b",
        text: "Protect the quality and find the money somewhere harder — the rent, the hours, the two things on the menu nobody orders.",
        consequence:
          "The two dead items come off, the linen goes fortnightly, and you go back to the landlord. It covers about two thirds of the gap and the rest comes out of hours.",
        world: { till: "tight", beans: "good" },
      },
      {
        id: "c",
        text: "Refuse it, and turn the standard into something people can see — build the kind of reputation that outlives a quarter's numbers.",
        consequence:
          "The roaster's name goes above the menu in bigger letters than anything else on it. Three people ask about it in the first week, which is three more than ever have.",
        world: { chalkboard: "beans_story", beans: "good" },
      },
    ],
    follow: {
      a: {
        prompt:
          "Five weeks of nobody noticing, and then Marcus leaves half a cup. He does not say anything about it, and he is in as usual the next morning.",
        choices: [
          {
            id: "a",
            text: "Go back to the good beans and tell him the cup he left was the reason, because he is the only measurement I trust in here.",
            consequence:
              "He laughs at you, which he has never done, and finishes the next one. The story goes round the four-top by the end of the week without your help.",
            world: { beans: "good", regulars: "full" },
          },
          {
            id: "b",
            text: "Go back to the good beans and say nothing to anybody, since the quarter is over and the reason for the cut has gone with it.",
            consequence:
              "The good sacks are back by Tuesday. Nobody remarks on it, and you are left knowing something about five weeks of this place that nobody else does.",
            world: { beans: "good" },
          },
          {
            id: "c",
            text: "Hold for the rest of the quarter and put the difference into a proper answer, because one cup is not a business decision.",
            consequence:
              "You hold six more weeks and save what you meant to save. Marcus is in every morning and the cup is half full about one morning in three.",
            world: { beans: "cheap", till: "healthy" },
          },
        ],
      },
      b: {
        prompt:
          "Two thirds came out of the room and the last third came out of hours. Priya has done the arithmetic and knows exactly whose hours those were.",
        choices: [
          {
            id: "a",
            text: "Tell her what the last third cost and whose it was, and ask her whether she would have cut it somewhere else.",
            consequence:
              "She would have taken it off the Sunday rather than the Thursday, and she is right. The hours go back where she says and the number is the same.",
            world: { staff: "trusting" },
          },
          {
            id: "b",
            text: "Put the hours back and take the last third out of my own draw, since I am the one who chose the beans.",
            consequence:
              "Nobody is told and everybody works it out. It is a lean November for you and the rota stops being something people check twice.",
            world: { staff: "trusting", till: "tight" },
          },
          {
            id: "c",
            text: "Leave it, and say plainly that the coffee was the thing I would not move and the hours were what was left.",
            consequence:
              "You say it once and do not repeat it. It is accepted, and the word that comes back to you second-hand a fortnight later is not a warm one.",
            world: { staff: "strained" },
          },
        ],
      },
      c: {
        prompt:
          "The name is up and three people have asked about it. The invoice has not moved, and the quarter still needs the money it needed in September.",
        choices: [
          {
            id: "a",
            text: "Put the price up eight pence a cup and say why on the board, since the story only works if it pays for something.",
            consequence:
              "The board says where the beans come from and what a cup costs now. Two people mention the price in a month, and both of them stay.",
            world: { chalkboard: "beans_story", till: "healthy" },
          },
          {
            id: "b",
            text: "Hold the price and find the quarter elsewhere, because raising it the week I made a promise about quality reads badly.",
            consequence:
              "You find it in the linen and the card fees and a supplier you had never renegotiated. It takes three weeks of evenings and it holds.",
            world: { till: "healthy" },
          },
          {
            id: "c",
            text: "Ask the roaster what they can do on volume now their name is on my wall, and go back to them with the traffic numbers.",
            consequence:
              "They come back with nine per cent and a bag of the single origin for the window. It is not the whole quarter and it is the easiest part of it.",
            world: { beans: "good", till: "tight" },
          },
        ],
      },
    },
  },

  // C9 · adaptability_pivoting. The Advanced path is adapting without
  // abandoning, which is exactly what the three branches below cost differently.
  "C9-SCB-01": {
    activityId: "C9-SCB-01",
    stage:
      "Well-funded competition, three straight weeks of decline, and staff who have started reading the room. Marcus's chair has been empty twice this fortnight. This is the third hard stretch this year and the first that has not turned by itself.",
    prompt: "Three weeks. I'm not panicking. I'd just like to know what we're doing.",
    seed: [
      {
        id: "a",
        text: "Move first and move big. Three weeks of decline is a trend, and the worst thing you can do against funded competition is nothing.",
        consequence:
          "Prices down, hours out, a board on the pavement, all in one week. Takings come back for nine days and the fourth week is worse than the third was.",
        world: { till: "strained", rival: "promo" },
      },
      {
        id: "b",
        text: "Steady the team, find out what is actually causing the drop, and adjust tactics without abandoning the direction.",
        consequence:
          "You spend a week counting instead of deciding. It is not the coffee and it is not the price. They open at seven, and the 7:50 window has quietly gone.",
        world: { regulars: "steady" },
      },
      {
        id: "c",
        text: "Absorb it. Work out precisely what to hold and what to change, and use the pressure to make the business and myself harder to move.",
        consequence:
          "Two lists. Everything on the first one holds and four things on the second one change. Nothing improves for a fortnight and then, without any single reason, it does.",
        world: { regulars: "returning" },
      },
    ],
    follow: {
      a: {
        prompt:
          "Nine good days, and then the fourth week comes in under the third. The board is still out on the pavement and the prices are still down.",
        choices: [
          {
            id: "a",
            text: "Put the prices back and say so out loud, because a discount that has stopped working is a discount that is only costing me now.",
            consequence:
              "Prices go back on the Monday with a line on the board about it. Nine people ask; none of them leave; the fifth week is flat rather than down.",
            world: { till: "tight" },
          },
          {
            id: "b",
            text: "Hold the discount into a fifth week, since a fortnight is not long enough to know whether habit has moved back or not.",
            consequence:
              "The fifth week is flat and the sixth is down again, and by then the discount is what people expect rather than what brings them in.",
            world: { till: "strained" },
          },
          {
            id: "c",
            text: "Stop moving, take a week to find out what is actually happening, and change one thing after that rather than four.",
            consequence:
              "You count for six days. It is the seven o'clock opening, and you have spent a month and a margin on things that were never the reason.",
            world: { rival: "promo" },
          },
        ],
      },
      b: {
        prompt:
          "It is the seven o'clock opening. Matching it costs a staff hour a day that you have not budgeted for and cannot obviously find.",
        choices: [
          {
            id: "a",
            text: "Open at seven with just me on the bar for a month, and find out what that hour is worth before I pay anybody for it.",
            consequence:
              "Four weeks of alarms at half five. The hour is worth about two thirds of a staff hour, which is a number you can now make a decision with.",
            world: { staff: "easy" },
          },
          {
            id: "b",
            text: "Don't match it. Take the 8:50 instead, and make the second half of the morning into something they cannot copy quickly.",
            consequence:
              "The 8:50 becomes yours over about six weeks — the table service, the pastries out late, the room being quiet. The seven o'clock trade never comes back.",
            world: { regulars: "steady" },
          },
          {
            id: "c",
            text: "Match it properly with Priya on, and cut the hour off the dead end of the afternoon, because the trade is where the trade is.",
            consequence:
              "You open at seven and close at four. The mornings come back inside a month and the two people who used the afternoons say so, once each.",
            world: { regulars: "returning", staff: "strained" },
          },
        ],
      },
      c: {
        prompt:
          "A fortnight of nothing, and then two of the four changes start working at once. Priya asks which of them you are planning to keep.",
        choices: [
          {
            id: "a",
            text: "Keep both and stop the other two, and write down what made the difference while I can still actually remember it.",
            consequence:
              "The note goes inside the stockroom door under the testing rule. In February you use it, and it saves you most of a month.",
            world: { regulars: "returning" },
          },
          {
            id: "b",
            text: "Keep all four another month, since two working out of four in a fortnight is not enough to start cutting things on.",
            consequence:
              "The other two never come good and cost you a fortnight each in attention. The two that worked keep working, slightly slower than they would have.",
            world: { till: "tight" },
          },
          {
            id: "c",
            text: "Keep the two, and take what I learned about which held and which moved into the next stretch, because there will be one.",
            consequence:
              "There is one, in March, and it lasts nine days rather than three weeks. Nobody remarks on that at the time, including you.",
            world: { regulars: "returning", staff: "trusting" },
          },
        ],
      },
    },
  },
};
