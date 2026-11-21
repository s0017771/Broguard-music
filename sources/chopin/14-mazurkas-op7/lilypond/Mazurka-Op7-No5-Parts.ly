%...+....1....+....2....+....3....+....4....+....5....+....6....+....7....+....

globalNoFive = {
  \key c \major
  \time 3/4
  \accidentalStyle piano
}

rightHandNoFive = \relative c'' {
  \globalNoFive
  \clef treble
  \tempo "Vivo." 2. = 60
  
  R2. * 4 |
  \bar "||"
  
  \barNumberCheck 5
  \tuplet 3/2 { d8(^\segno e d) } g,4-> c8.( e16) |
  \tuplet 3/2 { d8( e d) } g,4-> c8.( e16 |
  a4 g8.[ e16 f8. d16]) |
  c8.([ e16 g8. b16 d8. c16]) |
  \tuplet 3/2 { d,8( e d) } g,4-> c8.( e16) |
  \tuplet 3/2 { d8( e d) } g,4-> c8.( e16 |
  a4 g8.[ e16 f8. d16]) |
  c8.([ d16 e8. b16 d8. c16]) |
  
  \barNumberCheck 13
  \tuplet 3/2 { a8( b a) } d,4->( g8. b16) |
  \tuplet 3/2 { a8( b a) } d,4->( g8. b16) |
  e4( d8.[ b16 c8. a16]) |
  g8.[( b16 d8. fs16 a8. g16]) |
  \tuplet 3/2 { a,8( b a) } d,4->( g8. b16) |
  \tuplet 3/2 { a8( b a) } d,4->( g8. b16) |
  e4( d8.[ b16 c8. a16]) |
  g8.[( b16 d8. fs16 a8. g16]) <>\mark \markup { 
    \small \raise #1 \musicglyph #"scripts.segno" } |
  \bar "|."
}

leftHandNoFive = \relative c {
  \globalNoFive
  \clef bass
  
  <g g'>4-.( q-. q-. |
  <g g'>4-. q-. q-. |
  <g g'>4-. q-. q-. |
  <g g'>4-. q-. q-.) |
  
  \barNumberCheck 5
  <g' b f'>4 <g c e>-. q(-> |
  <g b f'>4) <g c e>-. q(-> |
  <g b f'>4) q-. q-. |
  c,4 <g' c e> q( |
  <g b f'>4) <g c e>-. q(-> |
  <g b f'>4) <g c e>-. q(-> |
  <g b f'>4) q-. q-. |
  c,4 <g' c e>_\< q(\! |
  
  \barNumberCheck 13
  <d fs c'>4) <d g b>-. q(-> |
  <d fs c'>4) <d g b>-. q(-> |
  <d fs c'>4) q-. q-. |
  g,4 <d' g b> q( |
  <d fs c'>4) <d g b>-. q(-> |
  <d fs c'>4) <d g b>-. q(-> |
  <d fs c'>4) q-. q-. |
  g,4 <d' g b> q |
}

pedalNoFive = {
  s2.\sd |
  s2. |
  s2. |
  s2 s8 s\su |
  
  \barNumberCheck 5
  s2. * 3 |
  s2\sd s8. s16\su |
  s2. * 3 |
  s4\sd s8 s\su s4 |
  
  \barNumberCheck 13
  s2. * 3 |
  s2\sd s8. s16\su |
  s2. * 3 |
  s2\sd_"Dal Segno senza Fine." s8. s16\su |
}

dynamicsNoFive = {
  s2^\markup { \dynamic f semplice. } s4\>
  s2. |
  s2. |
  s2 s4\! |
  
  \barNumberCheck 5
  s2.^"mezza voce." |
  s2 s4\< |
  s2.\sf\> |
  s2\< s8.\fz\> s16\! |
  s2. |
  s2 s4\< |
  s2.\fz\> |
  s4\< s8. s16\> s4 <>\! |
  
  \barNumberCheck 13
  s2.^"sotto voce." |
  s4 s2\< |
  s2.\fz\> |
  s2\< s4\sf\> |
  s4 s2\< <>\! |
  s4 s2\< |
  s2.\fz\> |
  s2\< s4\> <>\! |
}
