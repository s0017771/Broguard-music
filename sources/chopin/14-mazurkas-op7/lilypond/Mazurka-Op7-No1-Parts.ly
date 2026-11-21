%...+....1....+....2....+....3....+....4....+....5....+....6....+....7....+....

globalNoOne = {
  \key bf \major
  \time 3/4
  \accidentalStyle piano
  \override Slur.details.accidental-collision = #1000
}

rightHandNoOne = \relative c' {
  \globalNoOne
  \clef treble
  \tempo "Vivace" 2. = 50
  
  f8[( r16 f] g4 a |
  bf8[) r16 c] d4( ef8 f |
  g8[) r16 a] bf4(\trill a8 g) |
  \slashedGrace { f8 } bf8-![ r16 bf]( d,2) |
  \slashedGrace { ef8 } g8-![ r16 g]( a,2) |
  \slashedGrace { bf8 } d8-![ r16 d]( e,2) |
  f8[ r16 a( c8 ef g8.) f16] |
  \slashedGrace { f8 } d'8[ r16 c bf8 \prall g]( f4) |
  \slashedGrace { g16 } bf8-![ r16 bf16]( a,2) |
  \grace { bf16 d } f8-![ r16 f]( e,2) | 
  f8[ r16 a( c8 ef d)\prall c] |
  d8[^! r16 f,]^( bf4 a8 g) |
  
  \barNumberCheck 13
  f8[ r16 f]( g4 a) |
  bf8[ r16 c]( d4 ef8 f |
  g8)[ r16 a] bf4\trill a8 g |
  \slashedGrace { f8 } bf8-![ r16 bf]( d,2) |
  \slashedGrace { ef8 } g8-![ r16 g]( a,2) |
  \slashedGrace { bf8 } d8-![ r16 d]( e,2) |
  f8[ r16 a( c8 ef g8.) f16] |
  \slashedGrace { f8 } d'8[ r16 c]( bf8\prall g] f4) |
  \slashedGrace { g8 } bf8-![ r16 bf]( a,2) |
  \slashedGrace { bf16 d } f8-![ r16 f]( e,2) |
  f8-![ r16 a c8 ef d\prall c] |
  d8[ r16 f,]( \stemUp bf4) 
  \pgBreak
  \bar ".|:"
  
  \repeat volta 2 {
    \stemNeutral a8( bf) |
                                      
    %\barNumberCheck 25
    c8. d16 c4 e8( f |
    g8. a16 g4) f8( d |
    c8 d c4 e8)[ r16 f] |
    \tuplet 3/2 { g8( a g) } f4.-> d8 |
    c8 d c4 e8 f |
    g8 a g4\trill f8 d |
    c8 d c4 e8 f |
    \tuplet 3/2 { g8( a g) } f8.-^ g,16( \tempo "a Tempo"
      \tuplet 3/2 { f'8)\( gf,( f')\) } |
    
    %% Have to put the grace note before the bar check or else it fails
    \slashedGrace { f8 }
    %\barNumberCheck 33
    f,8[ r16 f]( g4 a |
    bf8)[ r16 c]( d4 ef8 f |
    g8)[ r16 a] bf4(\trill a8 g) |
    \slashedGrace { f8 } bf8-![ r16 bf]( d,2) |
    \slashedGrace { ef8 } g8-![ r16 g]( a,2) |
    \slashedGrace { bf8 } d8-![ r16 d]( e,2) |
    f8[ r16 a( c8 ef g8. f16]) |
    \slashedGrace { f8 } d'8[ r16 c( \slashedGrace { c8 } bf\prall g] f4) |
    \slashedGrace { g8 } bf8[ r16 bf]( a,2) |
    \slashedGrace { bf16 d } f8[ r16 f]( e,2) |
    f8[ r16 a c8 ef\prall d c] |
    d8[-. r16 f,]( bf4) 
    \bar ":..:" 
    \pgBreak
  }
  \repeat volta 2 { 
    r |
  
    %\barNumberCheck 45
    f'8-^[ r16 f]( e4 df8 c) |
    bf8[ r16 df]( c4\prall bf8)[ r16 e,]( |
    f'8)[ r16 f]( e4 df8 c) |
    \tuplet 3/2 { bf8( c bf) } e,2-> |
    f'8[-. r16 f]( e4 df8 c |
    bf8)[ r16 df]( \slashedGrace { c8 } c4\trill bf8[) r16 e,]( |
    f'8)[ r16 f]( e4 df8. c16) |
    \tuplet 3/2 { bf8( c bf) } \tempo "a Tempo." a4. g8 |
    
    %\barNumberCheck 53
    f8[ r16 f]( g4 a |
    bf8)[ r16 c]( d4 ef8 f |
    g8)[ r16 a]( bf4\trill a8 g) |
    \slashedGrace { f8 } bf8[-! r16 bf]( d,2) |
    \slashedGrace { ef8 } g8[-! r16 g]( a,2) |
    \slashedGrace { bf8 } d8[-! r16 d]( e,2) |
    f8[ r16 a( c8 ef g8.) f16] |
    \slashedGrace { f8 } d'8[ r16 c( bf8\prall g] f4) |
    \slashedGrace { g8 } bf8[-! r16 bf]( a,2) |
    \slashedGrace { bf16 d } f8[-! r16 f]( e,2) |
    f8[ r16 a( c8 ef d8.)\prall c16] | 
  }
  \alternative {
    { d8[ r16 f,]( bf4) }
    { d8( f,) <bf bf'>4 \fermata \bar "|." }
  }
  \pgBreak
}

leftHandNoOne = \relative c, {
  \globalNoOne
  \clef bass
  \override Beam.auto-knee-gap = 4
  
  f4-. <f' c' ef> q |
  bf,4-. <f' bf d> bf,-. |
  <ef, ef'>4 <g' bf ef g>_\fz\arpeggio r |
  bf,4-.^\markup { \italic "scherz." } <f' bf d> q |
  f,4-. <f' c' ef> q |
  bf,4-. <f' bf d> q |
  f,4-. <f' ef'> <f a ef'> |
  bf,4-. <f' bf d>4 q |
  bf,4-. <f' c' ef> q |
  bf,4-. <f' bf d>4 q |
  f,4-. <f' ef'> <f a ef'> |
  bf,4-. <f' bf d> r |
  
  \barNumberCheck 13
  f,4 <f' c' ef> q |
  bf,4 <f' bf d> bf, |
  <ef, ef'>4 <g' bf ef g>\arpeggio r4 |
  bf,4 <f' bf d> q |
  f,4 <f' c' ef> q |
  bf,4 <f' bf d> q |
  f,4 <f' ef'> <f a ef'> |
  bf,4 <f' bf d> q |
  bf,4 <f' c' ef> q |
  bf,4 <f' bf d> q |
  f,4 <f' ef'> <f a ef'> |
  bf,4 <f' bf d> 
  
  \repeat volta 2 {
    r4 |
      
    %\barNumberCheck 25
    f,4 <c' a'> q |
    f,4 <d' bf'> q |
    f,4 <c' a'> q |
    f,4 <d' bf'> f, |
    <c' a'>4-. f,-. <c' a'>-. |
    f,4-. <d' bf'>-. f,-. |
    <c' a'>4-. f,4-. <c'~ a'>-. |
    <c e bf'>4(^"poco rall:" <f a>) r | 
    
    %\barNumberCheck 33
    f,4 <f' c' ef> q |
    bf,4 <f' bf d> bf, |
    <ef, ef'>4 <g' bf ef g>\arpeggio r |
    bf,4 <f' bf d> q |
    f,4 <f' c' ef> q |
    bf,4 <f' bf d> q |
    f,4 <f' ef'> <f a ef'> |
    bf,4 <f' bf d> q |
    bf,4 <f' c' ef> q |
    bf,4 <f' bf d> q|
    f,4-. <f' ef'> <f a ef'> |
    bf,4 <f' bf d> 
  }
  
  \repeat volta 2 {
    bf,-. |
    
    %\barNumberCheck 45
    <gf df'>4-.( q-. q-.) |
    \repeat unfold 6 { <gf df'> q-> q } |
    << { df'4 c2-> } \\ { f,2. } >>
    
    %\barNumberCheck 53
    f4 <f' c' ef> q |
    bf,4 <f' bf d> bf, |
    <ef, ef'>4 <g' bf ef g>\arpeggio r |
    bf,4-. <f' bf d> q |
    f,4-. <f' c' ef> q |
    bf,4-. <f' bf d> q |
    f,4 <f' ef'> <f a ef'> |
    bf,4 <f' bf d>4 q |
    bf,4 <f' c' ef> q |
    bf,4 <f' bf d>4 q |
    f,4 <f' ef'> <f a ef'> |
  }
  \alternative {
    { bf,4 <f' bf d> }
    { bf,4 <bf f' d'>\fermata }
  }
}

pedalNoOne = {
  \repeat unfold 9 { s2\sd s8 s\su | }
  s2. |
  s2\sd s8 s\su |
  s4.\sd s8\su s4 |
  
  \barNumberCheck 13
  \repeat unfold 3 { s2\sd s8 s\su | }
  s2. * 9 |
  
  \barNumberCheck 25
  s2. * 8 |
  
  \barNumberCheck 33
  s2. * 12 |
  
  \barNumberCheck 45
  s2.\sd |
  s2. * 5 |
  s2 s8. s16\su |
  s2. |

  \barNumberCheck 53
  s2\sd s8 s\su |
  s2\sd s8 s\su |
  s4\sd s\su s | 
  % nothing till end
}

dynamicsNoOne = {
  s2.\f |
  \override TextSpanner.bound-details.left.text = "cres"
    s2\startTextSpan s8. s16\stopTextSpan | 
  s2\ff s8.\> s16\! |
  s8.\p s16\> s2\! |
  s8. s16\> s2\! |
  s8. s16\> s2\! |
  s8. s16\< s4 s\! |
  \repeat unfold 3 { s8. s16\> s4\! s } |  
  s2. * 2 |
  
  \barNumberCheck 13
  s2.\startTextSpan |
  s2 s8 s16 s16 |
  s8 s16\stopTextSpan s\f s2 |
  s8.\p s16\> s2\!
  s8. s16\> s2\!
  s8. s16\> s2\!
  s8. s16\< s4 s\! |
  s8. s16\> s8\! s4. |
  s8. s16\> s2\! |
  s8. s16\> s2\! |
  s8. s16\< s8\! s s\> s\! |
  s2
  
  s4-\markup { \dynamic p \whiteout \italic legato. } | \barNumberCheck 25
  s2 s4\< |
  s8. s16\! s2 |
  s2 s8.\< s16\! |
  s2. |
  s2.-\markup { \italic stretto. } |
  s2. |
  s4 s2\< |
  s8.\> s16\! s2 |
  
  \barNumberCheck 33
  s2.\f |
  s2.-\markup { \italic cres. } |
  s4\ff s\fz s8.\> s16\!
  s8.\p s16\> s2\! |
  s8. s16\> s2\! |
  s8. s16\> s2\! |
  s2\< s8.\> s16\! |
  s8. s16\> s8 s\! s4 |
  \repeat unfold 2 { s8. s16\> s2\! } |
  s8. s16\< s8 s\! s4 |
  s2\f
  
  \repeat volta 2 {
    s4\pp |
  
    %\barNumberCheck 45
    s2.-\markup { \italic "sotto voce" } |
    s2 s8. s16\< |
    s16 s\! s8 s2 |
    s2. |
    s4-\markup { \dynamic p "rubato" } s2 |
    s2 s8. s16\< |
    s4\pp s2 |
    s2.-\markup { \italic "poco rall:" } % s4-\markup { \italic "a Tempo" } |
    
    %\barNumberCheck 53
    s2.\f |
    s4 s^"cres." s |
    s8. s16\f s2 |
    s8.\p s16\> s2\! |
    s8. s16\> s2\! |
    s8. s16\> s2\! |
    s8. s16\< s4 s4\!
    s8. s16\> s8 s\! s4 |
    s8. s16\> s2\! |
    s8. s16\> s2\! |
    s8. s16\> s8 s\! s4 |
  }
  \alternative {
    { s2\f }
    { s4 s\fz }
  }
}
