const quotePath='M42 0C19 0 0 18 0 42s18 42 42 42c10 0 19-3 26-9-7 26-25 44-53 54l7 15c43-13 67-46 67-92C89 21 70 0 42 0Z';

// Content semantics and artwork vary by type; the card renderer stays shared.
export const cardTypes=Object.freeze({
  idea:{
    id:'idea',className:'',showTitle:true,bodyTag:'p',accessibleHeading:null,headerIcon:null,
    watermark:{viewBox:'0 0 160 180',paths:'<path d="M80 9c-32 0-57 24-57 56 0 22 10 36 24 49 7 7 10 14 10 23h46c0-9 3-16 10-23 14-13 24-27 24-49 0-32-25-56-57-56Z"/><path d="M56 148h48v7c0 12-10 22-24 22s-24-10-24-22Z"/>'}
  },
  quote:{
    id:'quote',className:'quote-card',showTitle:false,bodyTag:'blockquote',accessibleHeading:'quoteBody',headerIcon:'❝',
    watermark:{viewBox:'-6 -6 207 156',paths:`<path d="${quotePath}"/><path d="${quotePath}" transform="translate(106)"/>`}
  },
  readingGuide:{
    id:'reading-guide',className:'reading-guide-card',showTitle:false,bodyTag:'p',accessibleHeading:'readingGuideBody',headerIcon:'reading-guide',
    watermark:{viewBox:'0 0 24 24',paths:'<path d="M5.5 3.5h9.4a4.1 4.1 0 0 1 4.1 4.1V20H7.3a3 3 0 0 1-3-3V5.2a1.7 1.7 0 0 1 1.2-1.7Z"/><path d="M7.2 3.7v13.5A2.8 2.8 0 0 0 10 20"/><path d="M13.7 10.1v5.1"/><path d="M13.7 8.1h.01"/>'}
  }
});

export function cardTypeFor(card){return cardTypes[card.isReadingGuide?'readingGuide':card.isQuote?'quote':'idea']}
