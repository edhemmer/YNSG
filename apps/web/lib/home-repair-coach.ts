// Hand-holding layer for the home repair field guide (owner training notes, written 2026-11-23).
// The base guides give the steps; this adds the coaching a first-timer wants on the tricky ones:
// what to set up first, what you should SEE at the key steps, what to try when you're stuck, what
// to avoid, the mistakes people make, and how to know the job is really done. Same rules as the
// guides: the product's own instructions win, nothing here expands YNSG's approved services, and a
// guide's "stop and refer" line always applies. Step numbers are zero-based and match the guide.

export type StepCoach = {see?: string; help?: string; avoid?: string; careful?: boolean};
export type Coach = {before?: string[]; steps?: Record<number, StepCoach>; mistakes?: string[]};

export const COACH: Record<string, Coach> = {
  'drywall-patch': {
    before: ['Lay a drop cloth and keep a vacuum handy; sanding makes fine dust.', 'Shine a flashlight into any hole bigger than a nail hole to check for wires or pipes before cutting.', 'Plan on two or three visits: each coat of compound needs to dry (often several hours to overnight).'],
    steps: {
      0: {see: 'The edges are flat or slightly dished, with no raised paper or crumbly bits.', help: 'Press around the hole with a fingertip. If it feels soft or crumbles, keep cutting back until the edge is firm.'},
      1: {see: 'The spackle sits a hair proud of the wall when wet and shrinks level as it dries.', help: 'Drag the putty knife at a shallow angle in one pass. Going back over wet spackle is what leaves ridges.', avoid: 'Overfilling and planning to sand it flat. Thin coats are easier than heavy sanding.'},
      2: {careful: true, see: 'You can still faintly see the mesh pattern after the first coat. That is fine.', help: 'Peel the backing, center the patch over the hole and press from the middle outward so it has no wrinkles. Spread compound through the mesh and 1–2 inches past it, then leave it thin.'},
      3: {careful: true, help: 'Backers are scrap boards a few inches longer than the hole. Slide one inside against the back of the wall and drive screws through the existing drywall into it, one on each side. The new piece then screws to the backers, with screw heads just below the paper face, not tearing it.', avoid: 'Screwing into anything you cannot see behind. If you cannot tell what is behind the hole, stop and ask the owner.'},
      4: {see: 'Run your palm across it with your eyes closed: you should not feel an edge.', help: 'Use a wider knife for each coat and hold it nearly flat, pulling from the center outward so the edge disappears into the wall.', avoid: 'Trying for perfect in one coat. Thin coats dry faster and sand easier.'},
      5: {help: 'Sand with a sponge in light circles, wipe with a damp cloth, prime the patch, then paint two thin coats a little past the primed area. Hold a flashlight low along the wall: flaws show up as shadows, and one more skim coat fixes them.', avoid: 'Skipping primer. Bare compound soaks up paint and shows as a dull spot.'},
    },
    mistakes: ['Putting on too much compound at once: it cracks and takes forever to dry.', 'Sanding before it is fully dry: it clogs and gouges.', 'Painting without primer, so the patch shows through as a dull spot.'],
  },
  'grout-repair': {
    before: ['Wear safety glasses and a dust mask while removing old grout.', 'Take a photo in good light and bring a clean sample of the grout to the store to match color.', 'Plan for the area to stay dry for the cure time on the label (often 24–72 hours).'],
    steps: {
      1: {careful: true, help: 'Pull the saw along the joint with moderate pressure, staying centered so you do not chip tile edges. Work a short section at a time.', avoid: 'Digging all the way down to the backer board. You only need to take out the loose or cracked grout.'},
      2: {see: 'Joints are free of dust and look slightly damp, with no puddles.'},
      3: {see: 'Joints are full and slightly proud of the tile, with no pinholes.', help: 'Mix only what you can use in about 20–30 minutes (follow the bag). Hold the float at roughly 45° and sweep diagonally across the joints, pressing the grout in firmly so there are no voids.'},
      4: {help: 'Wait the time on the bag (usually 15–30 minutes) until the grout is firm but not hard. Rinse the sponge often and wipe lightly. Heavy pressure pulls grout out of the joints.', avoid: 'Too much water: it weakens the grout and washes out the color.'},
      5: {help: 'Corners and the line where tile meets a tub or counter move slightly, so they need flexible caulk, not rigid grout.'},
    },
    mistakes: ['Choosing color in store light instead of matching a clean, dry spot at home.', 'Mixing too much grout at once; it sets in the bucket.', 'Washing too soon or too hard and pulling grout back out.'],
  },
  'dripping-faucet': {
    before: ['Take a photo of the faucet and look for a brand name on the handle or under the sink. The cartridge must match.', 'Plug the drain and lay a towel in the sink so no screw or small part is lost.', 'Keep the old parts to match at the store.'],
    steps: {
      0: {see: 'With the faucet open, the flow slows to a dribble and stops, so the pressure is relieved.', help: 'If a shut-off valve under the sink will not turn, stop. Shutting off the main water valve is the next step, so ask the owner.'},
      1: {help: 'A small decorative cap usually pops off with a thin blade. The screw under it is a Phillips or Allen. If the handle is stuck, wiggle it while pulling up.'},
      2: {careful: true, help: 'Take a photo before pulling anything and note which way the tab or notch points. The new cartridge goes in the same way.', avoid: 'Forcing it. If it will not budge, use a cartridge puller made for that brand.'},
      3: {help: 'Bring the old cartridge to the store or order by brand and model. Coat the new O-rings with a thin film of plumber\'s silicone grease.'},
      4: {see: 'Hot is on the hot side, cold on the cold side, and nothing drips when it is closed.', help: 'Open the shut-offs slowly, run each side for a minute to clear air, and check under the sink for dampness.'},
    },
    mistakes: ['Not matching the cartridge brand and model.', 'Losing a small screw down the drain.', 'Turning the shut-offs on fast, which blasts air and water.'],
  },
  'drawer-slides': {
    before: ['Take a photo of the old slides and measure their length. Replacements need to match.', 'Buy one pair of slides per drawer and check the package for the side clearance they need.', 'Have a pencil and a small level ready.'],
    steps: {
      0: {see: 'The drawer lifts free of the cabinet with no force.', help: 'Pull it out until it stops, then look for a small lever or tab on each side. On many slides one lever goes up and the other down. If nothing releases, lift the front slightly while pulling.'},
      2: {careful: true, help: 'Measure the slide\'s full length and the gap between the drawer side and the cabinet. The package states the clearance the slide needs; side-mount ball-bearing slides commonly need about 1/2 inch each side.'},
      3: {careful: true, help: 'Draw a level line at the height you want. Mount the front first, then the rear, keeping both sides at the same height so the drawer does not tilt.', avoid: 'Tightening everything before test-fitting. Use the slotted holes so you can adjust.'},
      4: {help: 'Some slides are left- and right-specific. Keep each pair together and match the orientation shown on the package.'},
      5: {see: 'The drawer closes flush with even gaps and rolls smoothly with no rubbing.'},
    },
    mistakes: ['Mixing up left and right slides.', 'Mounting the two sides at different heights.', 'Using screws long enough to poke through a thin drawer side.'],
  },
  'grab-bar': {
    before: ['A grab bar is safety equipment. It must go into a stud, or use anchors made and rated for grab bars. Ordinary wall anchors are not enough.', 'Check what is behind the wall: tile over studs, plumbing and wiring.', 'Decide the position with the person who will use it: their reach, height and stronger hand.'],
    steps: {
      0: {careful: true, help: 'Have the person stand or sit where they would use it and reach naturally. The bar goes where their hand lands, not just at a standard height.'},
      1: {careful: true, help: 'Use a stud finder, then confirm with a small drill bit or thin nail at a spot the flange will cover. Studs are typically 16 inches apart, center to center.'},
      2: {careful: true, avoid: 'Hammer mode on tile. Start slowly, with painter\'s tape on the spot so the bit does not skate.'},
      3: {help: 'Seal around the screws with silicone in wet areas so water cannot get into the wall.'},
      4: {see: 'There is no movement or creaking when you pull down and out with your full weight.', help: 'If it moves at all, stop and rework it. Do not leave it for use.'},
    },
    mistakes: ['Using plain plastic wall anchors.', 'Fastening only into drywall.', 'Mounting it where the user cannot reach it from where they would stand or sit.'],
  },
  'tv-mount': {
    before: ['Check the mount\'s weight rating and VESA pattern (the hole spacing on the TV\'s back, listed in the TV manual) against the TV.', 'Plan on two people: a TV is easy to drop.', 'Confirm the wall. Wood studs are the standard case; metal studs, brick or plaster need different hardware.'],
    steps: {
      0: {careful: true, help: 'Sit where you will watch and mark where the middle of the screen should be. Confirm with the customer before drilling.'},
      1: {careful: true, help: 'Mark both edges of each stud, then drill pilot holes in the center. Set the plate with the bubble centered before you drill.'},
      2: {avoid: 'Over-tightening. Stop when the bolt is snug; forcing it can strip the wood.'},
      3: {careful: true, help: 'Start each screw by hand. If it stops before it is snug, add the spacer. A screw that is too long can damage the inside of the TV.'},
      4: {see: 'The TV clicks onto the plate, the safety lock is engaged, and it does not tilt or wobble when you press it gently.'},
    },
    mistakes: ['Hanging on drywall with no stud.', 'Using screws that are too long and bottom out inside the TV.', 'Lifting the TV alone.'],
  },
  'washer-install': {
    before: ['Read the manual for shipping bolts, hose connections and drain height.', 'Measure doorways and stairs so the machine fits, and keep towels and a bucket nearby.', 'Make sure both shut-off valves turn and the outlet is grounded.'],
    steps: {
      0: {careful: true, help: 'Look on the back for 3–5 bolts with rubber grommets. Remove every one the manual lists. A shipping bolt left in will make the machine shake violently.'},
      1: {help: 'Put a rubber washer in each hose end. Red is hot and blue is cold. Hand-tighten, then give about a quarter-turn with pliers. Over-tightening cracks the washer.'},
      2: {avoid: 'Pushing the drain hose tight into the standpipe or sealing it. It needs an air gap so water can\'t siphon back.'},
      3: {help: 'Press down on each corner. If it rocks, adjust that leg again, then lock the nut.'},
      4: {see: 'Water fills, the drum spins, and nothing drips at any connection or on the floor.'},
    },
    mistakes: ['Leaving a shipping bolt in.', 'Swapping hot and cold hoses.', 'Skipping the leak check during the first cycle.'],
  },
  'dryer-vent': {
    before: ['Unplug the dryer. For gas dryers, close the gas valve but never disconnect the gas line.', 'Have a dryer vent brush kit and foil tape ready (not duct tape).', 'Lint is flammable, so work with the dryer cool and keep a vacuum handy.'],
    steps: {
      0: {careful: true, help: 'Slide the dryer out slowly so the duct and cord do not tug. If it is a gas dryer, do not move it far enough to strain the gas line.'},
      2: {see: 'Brush bristles come out clean at the outside hood, and the hood flap swings freely.'},
      3: {help: 'The male end of each duct section points toward the outside so lint rides over the seams. Foil tape seals the joints without screws that would catch lint.'},
      4: {see: 'A strong stream of air blows at the outside hood and the flap opens fully.', help: 'If airflow is weak, there is still a blockage or a crushed section somewhere.'},
    },
    mistakes: ['Using plastic or foil accordion duct.', 'Using screws that poke into the duct and snag lint.', 'Skipping the airflow test at the hood.'],
  },
  'wall-shelf': {
    before: ['Decide what the shelf will carry. Heavy items need studs.', 'Find the studs first and mark them. If a bracket cannot land in a stud, use anchors rated well above the load.'],
    steps: {
      0: {help: 'Hold a level against the wall, draw the line lightly in pencil, and mark stud centers along it.'},
      1: {careful: true, avoid: 'Trusting drywall alone. Brackets without studs or proper anchors pull out over time.'},
      4: {see: 'No movement, creaking or tilt when you press down on the front edge and ends.'},
    },
    mistakes: ['Skipping the level line.', 'Using short screws that only catch drywall.', 'Loading the shelf before testing it.'],
  },
  'door-sticking': {
    before: ['Find where it rubs. Close the door on a strip of paper or rub chalk on the edge; marks on the door show the contact point.', 'Tighten hinges first; many doors need nothing more.'],
    steps: {
      0: {see: 'All hinge screws are snug, and the door no longer wobbles when you lift it by the knob.'},
      1: {help: 'Replace one screw at a time so the door never comes loose. The long screw reaches the stud and pulls the door back into line.'},
      3: {help: 'Rubbing at the top corner on the latch side usually means a sagging hinge. Rubbing along the latch edge usually means swelling or paint buildup.'},
      4: {careful: true, avoid: 'Planing a door that only rubs because of loose hinges.'},
      5: {see: 'The edge is sealed so it will not take on moisture again.'},
    },
    mistakes: ['Planing before tightening the hinges.', 'Removing too much wood at once.', 'Leaving bare wood unsealed.'],
  },
  'door-wont-latch': {
    before: ['Rub lipstick, a crayon or a dry-erase marker on the end of the latch bolt, then close the door. The mark on the strike plate shows where it lands.'],
    steps: {
      1: {see: 'The mark shows where the latch hits the strike plate and which way it needs to move.'},
      2: {help: 'File only the edge where the mark is. Take a little off, then test the door.'},
      4: {careful: true, help: 'Fill the old screw holes with glued wooden toothpicks or plugs before drilling, or the new screws will not hold.'},
    },
    mistakes: ['Moving the strike plate before tightening the hinges.', 'Drilling new holes next to unfilled old ones.', 'Filing too much at once.'],
  },
  'running-toilet': {
    before: ['Lift the tank lid and set it somewhere safe so it does not crack.', 'Add a few drops of food coloring to the tank. If color appears in the bowl without flushing, the flapper is leaking.'],
    steps: {
      0: {see: 'The chain has a little slack (about 1/2 inch) and the flapper drops fully.'},
      1: {help: 'The water should stop about 1/2 inch below the top of the overflow tube, or at the fill line marked in the tank.'},
      2: {careful: true, help: 'Take the old flapper with you to match the size (2-inch or 3-inch). Turn off the supply valve and flush to empty the tank first.'},
    },
    mistakes: ['Buying the wrong flapper size.', 'Making the chain too tight so the flapper never fully seats.', 'Forgetting to turn the water back on slowly.'],
  },
  'toilet-clog': {
    before: ['Do not flush again while it is clogged. The bowl can overflow.', 'Put old towels around the base and wear gloves.'],
    steps: {
      2: {see: 'The cup is fully covered by water and seals in the bowl opening.'},
      3: {help: 'Push gently first to push out air, then firmly, 10–15 strokes with the seal kept. Pull off and check the water.'},
      4: {see: 'The water drains normally and the bowl refills to its usual level.'},
    },
    mistakes: ['Flushing again before the clog clears.', 'Using a flat sink plunger on a toilet.', 'Pouring chemical drain cleaner in, which makes later plunging unsafe.'],
  },
  'caulk-tub': {
    before: ['Check the cure time on the tube; the tub or shower must stay dry that long.', 'Pick 100% silicone or a kitchen-and-bath sealant labeled for wet areas.'],
    steps: {
      0: {help: 'Use a plastic scraper or a caulk-removal tool. Metal blades can scratch acrylic tubs.'},
      1: {see: 'The joint is clean, dry and free of mildew, with no film or residue.'},
      3: {careful: true, help: 'Cut a small tip, apply the bead in one steady pass, then smooth it with a wet fingertip or a tool. Pull the tape right away.'},
    },
    mistakes: ['Caulking over old caulk or a damp joint.', 'Cutting the tip too large.', 'Using the shower before the cure time.'],
  },
  'window-sticks': {
    before: ['Lay a towel along the sill. Paint chips and dust will fall.', 'Check for painted-shut seams around the sash.'],
    steps: {
      0: {see: 'The sash moves slightly in the opening after the paint seal is cut.'},
      1: {avoid: 'Prying against the glass. Work against the frame and stop only on the wood.'},
      3: {help: 'Dry silicone spray or a bar of candle wax on the tracks works better than oil or grease, which collect dirt.'},
      4: {help: 'If the sash will not stay up, the balance is broken or unhooked. Note the brand and model from the label and plan a part order.'},
    },
    mistakes: ['Prying against the glass.', 'Using oil or grease on the tracks.', 'Missing the painted-shut seam on the outside.'],
  },
  'patio-door': {
    before: ['Vacuum the track well. Grit is the most common cause of a hard-to-slide door.', 'Removing the panel takes two people. Do not try it alone.'],
    steps: {
      2: {help: 'Look for small holes near the bottom of each end of the door panel, sometimes covered by plugs.'},
      3: {careful: true, help: 'Turn each screw a quarter-turn at a time and test after each turn. Keep both ends even or the door will bind.'},
      4: {careful: true, help: 'Worn rollers are replaced as a pair. Take one with you to match the size.'},
    },
    mistakes: ['Adjusting rollers without cleaning the track first.', 'Turning one roller far more than the other.', 'Using an oily lubricant on the track.'],
  },
  'picture-hang': {
    before: ['Hold the art up with a helper first and step back. Eyeball the spot before you mark anything.', 'Know the weight. Mirrors and framed glass are heavier than they look; check the hanger package rating.'],
    steps: {
      1: {help: 'Pull the wire tight toward the top the way it will hang, then measure from the peak of the wire to the top of the frame. Subtract that from your height mark to find where the hook goes.'},
      3: {careful: true, help: 'Match the hanger to the weight, not the size. When in doubt, go into a stud or use a rated anchor.', avoid: 'Trusting a lone nail for a heavy mirror.'},
      4: {see: 'The bubble sits centered and the frame looks level against the ceiling line and window trim.'},
    },
    mistakes: ['Marking the frame top instead of the hook point, so the art hangs too low.', 'Skipping the level and trusting the eye next to a slanted ceiling.', 'Using a light hook on a heavy frame.'],
  },
  'wall-anchors': {
    before: ['Find out what the wall is made of: drywall, plaster, tile or masonry. The anchor type depends on it.', 'Read the weight rating on the anchor package. It is the rating for that anchor in drywall, not a promise for any wall.'],
    steps: {
      0: {careful: true, help: 'Match the bit to the size printed on the package. Drill straight and just deep enough. A hole that is too big means the anchor spins and never grips.', avoid: 'Eyeballing the drill bit size.'},
      2: {help: 'Studs are the best hold. Knock lightly; a solid sound or a stud finder beep means wood or metal behind the wall.'},
      3: {careful: true, avoid: 'Hanging anything someone might lean on or grab from a plain plastic anchor.'},
    },
    mistakes: ['Using a bit that is larger than the anchor.', 'Overtightening and spinning the anchor in the hole.', 'Choosing by how big the item looks instead of its weight.'],
  },
  'cabinet-door-hinge': {
    before: ['Close the door and look at the gaps. Decide what is wrong first: too high, too low, too far left or right, or sticking out.', 'Use the right screwdriver size so the heads do not strip.'],
    steps: {
      0: {help: 'If a screw just spins, pull it, add a wood toothpick dipped in glue to the hole, let it dry and re-drive it.'},
      1: {see: 'The gap between two doors becomes even from top to bottom.'},
      4: {careful: true, help: 'Quarter-turns only. Make the same change on each hinge so the door does not twist.'},
    },
    mistakes: ['Turning one screw several full rotations at once.', 'Adjusting only the top hinge on a tall door.', 'Cranking stripped screws instead of repairing the hole.'],
  },
  'nail-pops': {
    before: ['Find every pop by holding a flashlight flat along the wall. Shadows show the bumps.', 'Plan on two or three thin coats with drying time in between.'],
    steps: {
      0: {careful: true, help: 'Drive the new screws first to pull the board snug against the framing. Do this before you touch the old nail.'},
      1: {see: 'The screw head sits in a small dimple, with the paper around it unbroken.', avoid: 'Driving so hard the head breaks through the paper.'},
      3: {help: 'Thin coats. The first fills the dimple, the second feathers wider. Sand lightly, prime, then paint.'},
    },
    mistakes: ['Hammering the old nail deeper and patching over it.', 'Filling with one thick coat that cracks.', 'Skipping primer so the patch shows.'],
  },
  'shower-head': {
    before: ['Plug the tub drain so no small part is lost.', 'Check that the new head has a rubber washer inside the nut.'],
    steps: {
      1: {careful: true, help: 'Hold the shower arm with one hand while you turn the head. Twisting the arm can damage the pipe inside the wall.'},
      3: {see: 'The tape lies flat, in the direction the head screws on.', help: 'Wrap in the same direction the new head turns on, so the tape tightens instead of unraveling.'},
      4: {avoid: 'Cranking with a wrench. Hand-tight plus a small snug is enough.'},
    },
    mistakes: ['Wrapping tape the wrong direction.', 'Overtightening and cracking the head.', 'Forgetting to hold the arm while loosening.'],
  },
  'faucet-aerator': {
    before: ['Lay a towel in the sink and plug the drain.', 'Some aerators use a small key. Check the faucet tip for a notch before using pliers.'],
    steps: {
      1: {help: 'Wrap the tip in tape or a rag before using pliers so the finish does not get scratched.'},
      2: {careful: true, help: 'Lay the parts out in order and snap a photo. They go back in the same stack.'},
      3: {see: 'The screen is clear and the holes show light through them.'},
    },
    mistakes: ['Scratching the finish with bare pliers.', 'Putting the parts back in the wrong order.', 'Skipping the flush before reinstalling.'],
  },
  'slow-drain': {
    before: ['Put on gloves and have a plastic bag ready for what comes out.', 'Skip chemical drain cleaners. They can damage pipes and splash, and they make later work unsafe.'],
    steps: {
      0: {help: 'Many stoppers lift out. Others release when you loosen the pivot nut under the sink and pull the rod. Look underneath to see which kind you have.'},
      1: {see: 'A tangle of hair and gunk comes up on the barbs.', help: 'Work the strip down slowly, then pull it up. Repeat until it comes up clean.'},
      2: {help: 'Plugging the overflow with a wet rag lets the plunge push the clog instead of leaking air.'},
    },
    mistakes: ['Using chemical cleaners first.', 'Dropping the hair back down the drain.', 'Plunging without blocking the overflow.'],
  },
  'window-caulk': {
    before: ['Pick a dry day above about 40°F. Cold or damp joints will not hold caulk.', 'Painter\'s tape on both sides of the joint gives a crisp, clean line.'],
    steps: {
      0: {careful: true, help: 'Remove every bit of loose old caulk. Fresh caulk only sticks to a clean, dry, firm surface.'},
      3: {see: 'One smooth, unbroken bead fills the joint with no gaps.', help: 'Cut the tip smaller than the gap. Push the gun along at a steady speed rather than dragging it.'},
      4: {help: 'Tool the bead right away and pull the tape while the caulk is still wet.'},
    },
    mistakes: ['Caulking over dirt or old caulk.', 'Cutting the tip too large.', 'Waiting until the caulk skins over before tooling it.'],
  },
  'garage-door': {
    before: ['This job involves a door that can close on someone. Keep people and pets clear while testing.', 'Never touch the springs or cables. Those are not part of this guide.'],
    steps: {
      0: {see: 'Both sensor lights are on and steady, with no blinking.'},
      2: {careful: true, help: 'Lay the board flat in the middle of the path and close the door with the remote. It should reverse as soon as it touches.'},
      3: {careful: true, avoid: 'Using the opener again until the safety reverse works. Stop and have it adjusted or serviced.'},
      4: {avoid: 'Grease on the tracks. It collects dirt. Lubricate the hinges and roller bearings only.'},
    },
    mistakes: ['Skipping the reverse test.', 'Greasing the tracks.', 'Adjusting the springs or cables, which is a repair for a trained technician.'],
  },
  'gate-sag': {
    before: ['Look for the real cause: loose hinge screws, a post that has moved, or a frame that has gone out of square.', 'Have a helper hold the gate while you work.'],
    steps: {
      1: {help: 'Prop the latch end up with a block and check the gate sits square against the post before you fasten anything.'},
      2: {careful: true, help: 'The brace runs from the bottom hinge corner up to the top latch corner. That direction puts it in compression so it holds the corner up.', avoid: 'Installing it the other way, which does nothing.'},
    },
    mistakes: ['Bracing in the wrong direction.', 'Fastening before squaring.', 'Trying to fix a leaning post by adjusting the gate.'],
  },
  'deck-board': {
    before: ['Check the joists under the board first. If they are soft or rotted, the job is bigger than a board swap.', 'Wear eye protection and gloves. Deck screws and old nails are sharp.'],
    steps: {
      1: {see: 'The joist is firm and solid when you press a screwdriver tip into it.', help: 'A joist you can sink a screwdriver into needs a closer look before you continue.'},
      2: {help: 'Lay a screw or nail between boards for an even gap, and match thickness and width before cutting.'},
      3: {careful: true, help: 'Pre-drill near the ends so the board does not split.'},
    },
    mistakes: ['Skipping the joist check.', 'Ending a board off a joist center.', 'Leaving the cut ends unsealed on treated lumber.'],
  },
  'paver-relevel': {
    before: ['Take a photo before you start, or lay out a chalk grid, so the pattern goes back the same way.', 'Plan for a full dry day and a bag of bedding sand and joint sand.'],
    steps: {
      0: {help: 'Lift one paver first. After that the rest come out easier.'},
      1: {careful: true, help: 'Fix the cause: low spots usually mean the base settled. Add and tamp base, then screed about 1 inch of sand.', avoid: 'Adding sand alone to a hole in the base.'},
      2: {see: 'Each paver sits flush with its neighbors with no rocking.'},
    },
    mistakes: ['Raising pavers with sand only.', 'Skipping the tamp.', 'Sweeping joint sand while the pavers are wet.'],
  },
  'mulch-beds': {
    before: ['Measure the bed so you buy the right amount. One cubic yard covers about 100 square feet at 3 inches.', 'Water dry beds the day before.'],
    steps: {
      1: {help: 'Measure with a ruler once. Fresh mulch settles, so start near 3 inches and let it settle to 2.'},
      2: {see: 'The trunk flares out at the ground with no mulch against the bark.', avoid: 'A mulch volcano piled against the trunk. It holds moisture against the bark and invites rot.'},
    },
    mistakes: ['Spreading it too thick.', 'Piling it against trunks and stems.', 'Laying it over weeds without pulling them first.'],
  },
  'shrub-pruning': {
    before: ['Identify the plant first. When it blooms decides when to prune.', 'Clean, sharp pruners cut cleaner and heal faster. Wipe blades with rubbing alcohol if you worked on a diseased plant.'],
    steps: {
      0: {help: 'Prune right after bloom. Waiting means cutting off next year\'s buds.'},
      2: {see: 'The shrub looks lighter and open, not shaved.'},
      3: {careful: true, help: 'Make the undercut first so the branch cannot tear the bark as it falls.'},
    },
    mistakes: ['Pruning spring bloomers in late winter.', 'Shearing everything into a ball.', 'Removing more than about a third in one visit.'],
  },
  'plant-shrub': {
    before: ['Call 811 before digging to have buried utilities marked. It is free and required.', 'Check the plant tag for sun and size, and confirm the spot fits both.'],
    steps: {
      0: {careful: true, help: 'The hole should be wide and shallow. Digging deep and filling loose soil lets the plant settle too low.'},
      2: {see: 'The root flare, where the trunk widens, is visible at ground level.', avoid: 'Burying the trunk.'},
      3: {help: 'Fill about half, water to settle, then fill and water again.'},
    },
    mistakes: ['Planting too deep.', 'Skipping the 811 call.', 'Leaving circling roots untouched.'],
  },
  'overseed': {
    before: ['Late summer to early fall is the best window in northern Illinois. Seed in spring only if needed.', 'Check the bag: the blend must suit the amount of sun, and fresh seed needs to stay moist.'],
    steps: {
      0: {help: 'Bag the clippings for this one cut so the seed reaches the soil.'},
      2: {careful: true, help: 'Set the spreader to the bag rate and make two passes, one in each direction.'},
      3: {see: 'The top inch of soil stays moist and never puddles.', help: 'Short, frequent waterings until the seed sprouts, then deeper and less often.'},
    },
    mistakes: ['Letting the seed dry out for a day.', 'Using a pre-emergent weed product on the same area.', 'Mowing too early or too short.'],
  },
  'pressure-wash': {
    before: ['Test a small hidden spot first. Too much pressure etches wood and concrete.', 'Wear eye and ear protection and closed shoes.'],
    steps: {
      2: {careful: true, avoid: 'Pointing the wand at people, pets, windows or siding seams.'},
      3: {help: 'Work in overlapping bands from the top down and rinse away from doors and the garage.'},
    },
    mistakes: ['Holding the tip too close.', 'Using a zero-degree tip on surfaces.', 'Washing toward the house or garage.'],
  },
  'hvac-filter': {
    before: ['Read the size printed on the old filter edge. Take a photo and buy the same size.', 'The arrow on the filter must point toward the blower.'],
    steps: {
      1: {see: 'The old filter is gray and clogged, which is normal.'},
      2: {careful: true, help: 'Check the arrow, slide it in flat and close the door fully.'},
    },
    mistakes: ['Putting it in backwards.', 'Buying the wrong size and forcing it.', 'Leaving the cover door ajar.'],
  },
  'smoke-alarm': {
    before: ['Check the date printed on the back of the alarm. Alarms are replaced around 10 years after manufacture.', 'Use the battery type listed on the alarm.'],
    steps: {
      0: {help: 'Chirping every minute or so usually means the battery. A chirp after a fresh battery points to the alarm itself.'},
      2: {see: 'A loud alarm pattern sounds for several seconds when you press the test button.'},
    },
    mistakes: ['Removing the battery and not replacing it.', 'Ignoring an alarm that is past its date.', 'Using the wrong battery type.'],
  },
  'garbage-disposal': {
    before: ['Never put your hand into a disposal, even when it is off.', 'The power must be off at the switch and unplugged or at the breaker before you touch anything.'],
    steps: {
      1: {careful: true, help: 'Fit the hex wrench in the socket at the center of the bottom and work it back and forth until it turns freely.'},
      2: {avoid: 'Reaching in by hand. Use tongs or pliers.'},
      3: {see: 'The motor hums and the blades spin freely once the reset is pressed.'},
    },
    mistakes: ['Reaching in with a hand.', 'Restoring power before the object is out.', 'Running hot water while grinding grease.'],
  },
  'curtain-blinds': {
    before: ['Decide the height and width before drilling. Rods look best 4 to 6 inches above the window and wider than the frame.', 'Have a helper hold the rod while you check level.'],
    steps: {
      0: {help: 'Mark both brackets with a level between them, not just by measuring from the trim.'},
      1: {careful: true, help: 'Into studs or rated anchors. Long rods need a center bracket.'},
    },
    mistakes: ['Skipping the level.', 'Mounting into drywall with no anchor.', 'Forgetting the center support on a long rod.'],
  },
  'closet-rod-shelf': {
    before: ['Mark the wall at the height you want, then find the studs before drilling.', 'Load matters: a closet rod holds more weight than people expect, so go into studs.'],
    steps: {
      0: {help: 'Use a long level and draw the line across the whole wall before cutting any cleat.'},
      3: {see: 'The rod seats fully in each socket and the shelf sits flat on the cleat.'},
    },
    mistakes: ['Hanging on drywall only.', 'Trusting the floor or ceiling as level.', 'Skipping the center support on a long span.'],
  },
  'outdoor-faucet': {
    before: ['Know where the inside shut-off for this faucet is before you start.', 'Take a photo of the faucet and note the brand. Replacement parts must match.'],
    steps: {
      0: {help: 'A leak around the handle often stops with an eighth-turn on the packing nut.'},
      1: {careful: true, help: 'Close the inside valve before taking anything apart, then open the outdoor faucet to drain.'},
      4: {avoid: 'Leaving a hose attached for the winter.'},
    },
    mistakes: ['Taking it apart with the water still on.', 'Overtightening the packing nut.', 'Leaving a hose connected when it freezes.'],
  },
  'floor-transition': {
    before: ['Measure the opening and take a photo of the height difference.', 'Check whether the floor is floating. If it is, do not nail through it.'],
    steps: {
      2: {help: 'T-molding is for equal heights, a reducer for unequal ones.'},
      4: {careful: true, avoid: 'Nailing through a floating floor. Fasten into the subfloor or use a track.'},
    },
    mistakes: ['Choosing the wrong profile.', 'Fastening a floating floor down.', 'Using grout where flexible caulk belongs.'],
  },
  'rescreen': {
    before: ['Measure the frame and buy mesh about an inch larger on every side.', 'Work on a flat surface with the frame supported.'],
    steps: {
      2: {careful: true, help: 'Roll slowly. The convex wheel pushes the mesh in and the concave wheel seats the spline.'},
      3: {see: 'The mesh is smooth and tight with no waves.', avoid: 'Pulling hard on the mesh while rolling. Over-stretching bows the frame.'},
    },
    mistakes: ['Stretching the mesh too tight.', 'Using a spline that is the wrong size.', 'Trimming before the spline is fully seated.'],
  },
  'trim-shoe-molding': {
    before: ['Practice a few cuts on scrap first. Corners are the hard part.', 'Nail into the baseboard so a floating floor can move.'],
    steps: {
      0: {help: 'Cope one piece so it nests against the other. Walls are rarely square, and a coped joint hides that.'},
      1: {careful: true, help: 'Measure each piece in place and cut a hair long so it presses in tight.'},
      3: {avoid: 'Nailing into the floor.'},
    },
    mistakes: ['Nailing into the floor.', 'Cutting a short piece.', 'Mitering inside corners that open up later.'],
  },
};

// Plain-words glossary: only terms that actually appear in the open guide are shown.
export const GLOSSARY: {term: string; means: string}[] = [
  {term: 'stud', means: 'The vertical wood or metal beam inside a wall. Screws hold best here.'},
  {term: 'shim', means: 'A thin wedge or spacer used to fill a small gap or level something.'},
  {term: 'reveal', means: 'The even gap between a door and its frame.'},
  {term: 'strike plate', means: 'The metal plate on the door frame that the latch clicks into.'},
  {term: 'flapper', means: 'The rubber stopper at the bottom of a toilet tank that lets water into the bowl.'},
  {term: 'cartridge', means: 'The part inside a faucet that controls water flow and temperature.'},
  {term: 'shut-off valve', means: 'The small valve under a sink or toilet that stops water to just that fixture.'},
  {term: 'feather', means: 'To blend the edge of compound or paint gradually into the surrounding surface.'},
  {term: 'pilot hole', means: 'A small starter hole that keeps a screw straight and stops wood from splitting.'},
  {term: 'vesa', means: 'The standard hole pattern on the back of a TV, which the mount must match.'},
  {term: 'caulk', means: 'A flexible sealant used where two surfaces meet so water cannot get in.'},
  {term: 'bead', means: 'The narrow line of caulk or sealant you lay along a joint.'},
  {term: 'anchor', means: 'A fastener that grips hollow walls like drywall. Weight ratings matter.'},
  {term: 'grout', means: 'The cement-based filler between tiles.'},
  {term: 'primer', means: 'A base coat that helps paint stick and look even.'},
  {term: 'o-ring', means: 'A small rubber ring that seals a joint against leaks.'},
  {term: 'standpipe', means: 'The vertical drain pipe a washing machine hose empties into.'},
];
