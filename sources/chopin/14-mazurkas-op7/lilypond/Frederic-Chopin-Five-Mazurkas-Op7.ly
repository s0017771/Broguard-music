%...+....1....+....2....+....3....+....4....+....5....+....6....+....7....+....

\version "2.22.1"
\language "english"

\include "Mazurka-Op7-Global-All.ly"
\include "Mazurka-Op7-No1-Parts.ly"
\include "Mazurka-Op7-No2-Parts.ly"
\include "Mazurka-Op7-No3-Parts.ly"
\include "Mazurka-Op7-No4-Parts.ly"
\include "Mazurka-Op7-No5-Parts.ly"

\paper {
  ragged-right = ##f 
  ragged-last-bottom = ##f 

  #(set-paper-size "letter")
}

\header {
  composer = "Frederic Chopin (1810-1849)"
  title = "Five Mazurkas"
  opus = "Opus 7"
  source = "http://www.chopinonline.ac.uk/ocve/browse/pageview/68617/"
  maintainer = "Knute Snortum"
  maintainerEmail = "knute (at) snortum (dot) net"
  copyright = "Creative Commons Attribution-ShareAlike 4.0"
}

\score {
  \new PianoStaff \with { instrumentName = \markup \huge "No. 1" } 
  <<
    \new Staff = "upper" \rightHandNoOne
    \new Dynamics = "dynamics" \dynamicsNoOne
    \new Staff = "lower" \leftHandNoOne
    \new Dynamics = "pedal" \pedalNoOne
  >>
  \layout { }
}

\header {
  opus = ""
}

\score {
  \new PianoStaff \with { instrumentName = \markup \huge "No. 2" } 
  <<
    \new Staff = "upper" \rightHandNoTwo
    \new Dynamics = "dynamics" \dynamicsNoTwo
    \new Staff = "lower" \leftHandNoTwo
    \new Dynamics = "pedal" \pedalNoTwo 
  >>
  \layout { 
    \context {
      \Staff
      \override RestCollision.minimum-distance = #0.4
    }
  }
}

\score {
  \new PianoStaff \with { instrumentName = \markup \huge "No. 3" } 
  <<
    \new Staff = "upper" \rightHandNoThree
    \new Dynamics = "dynamics" \dynamicsNoThree
    \new Staff = "lower" \leftHandNoThree
    \new Dynamics = "pedal" \pedalNoThree 
  >>
  \layout {
    \context {
      \PianoStaff
      \consists #Span_stem_engraver
    }
  }
}

\score {
  \new PianoStaff \with { instrumentName = \markup \huge "No. 4" } 
  <<
    \new Staff = "upper" \rightHandNoFour
    \new Dynamics = "dynamics" \dynamicsNoFour
    \new Staff = "lower" \leftHandNoFour
    \new Dynamics = "pedal" \pedalNoFour
  >>
  \layout { }
}

\score {
  \new PianoStaff \with { instrumentName = \markup \huge "No. 5" } 
  <<
    \new Staff = "upper" \rightHandNoFive
    \new Dynamics = "dynamics" \dynamicsNoFive
    \new Staff = "lower" \leftHandNoFive
    \new Dynamics = "pedal" \pedalNoFive
  >>
  \layout { }
}