export const CANDIDATES = [
  {
    name: "Robbie Baxter",
    address: "D3S6VBVPDD2Y2SNYFAT65AL25KUCKMY5IYM7RK3N4LMJIW44G2OWKBRSOI"
  },
  {
    name: "Simon Belingar",
    address: "YIP5W6ISX2GLMMF4FZD3GPXUFPTQKWQGGBJJW2ZIRLRQARZ4TUWBRBT37Q"
  },
  {
    name: "Patrick Bennett",
    address: "patrick.algo"
  },
  {
    name: "Scott Bolasevich aka Flipping",
    address: "7EISH72TGOIOMBHON3G5LE3HIZYORQL5R3KLKPI22YRGLW44JUW4UDNFGA"
  },
  {
    name: "Michael T Chuang",
    address: "michaeltchuang.algo"
  },
  {
    name: "Mohammad Ghaisi",
    address: "emg110.algo"
  },
  {
    name: "Taras Hirniak",
    address: "67OLU3IO4YWOAYJK273DQJS6RU2ES45WPAYHWNIQJNYKRXGZ5NPBMMEK3I"
  },
  {
    name: "Paul Hinrichsen",
    address: "3HOQI46R2WNG2NIUYZRTXUAMCJBED7ZBPQ7J5WV7K4LM2POBSUCLJWMUZA"
  },
  {
    name: "Dr. Uroš Hudomalj",
    address: "ZJC56ESEXZRYYWTVEZ56HFPDI54FTJ2WK3RJMVZRPVXR2KKWIHDA7EPSZM"
  },
  {
    name: "Andrew Shaman Kotulak",
    address: "IICAB345T3BQTQVTKUI24CV2VPEKBTVWGUCXXNTVXX2NNQDUMZBLTDOPAM"
  },
  {
    name: "Gábor Lipovszki",
    address: "KXK5TLUOTPXI36YJXMGDHGONH2CXAHPRU5ZPQRFFAYVKBAFNWGOOAUDMZE"
  },
  {
    name: "Mohamed Majdalawieh aka Angel of Ares",
    address: "IEDYR4YZTV22AZW7Q4UILNMHJN256MBBYOSKUK6RD6DSL5JSM46DTYJQKU"
  },
  {
    name: "Sean Menstell-Fraser",
    address: "NRXRF5I3IYRF6XCFIITU6IGH2XNJEPC42TMPVRCSTBOQDME4LMUDTO4BOU"
  },
  {
    name: "John Mizzoni",
    address: "FISHERMANBPAHXQJEBJNIMMTBVNCOTXG6TUHYXQNE64FEJRVDTO3E3A43E"
  },
  {
    name: "Kieran Nelson",
    address: "RS7TLLQRXKBAQDAVTSZC2ZLMVMLNSCL3FOUOESJJZ5XSKFFL56UI6X33CI"
  },
  {
    name: "Paweł Pierścionek",
    address: "YKTO4C2WAC2BSMJMYKM43YCGUYHU3XHAHAYG6UUSF3BLOF6VMGRXKYB7ZU"
  },
  {
    name: "Ľudovít Scholtz aka Everyday Algonaut",
    address: "ALGONAUTSPIUHDCX3SLFXOFDUKOE4VY36XV4JX2JHQTWJNKVBKPEBQACRY"
  },
  {
    name: "Nicholas Shellabarger aka Shelly",
    address: "7UBGYVIHJKBIDSVZABRZSGAMN55HZSBX4MK3VBCHVM6F7OIWSGEN3Z75L4"
  },
  {
    name: "Wilder Stubbs",
    address: "6OTYAIMCZ6DLBXMOOYD7P3AQGWP5IKDVJOHMJWKGUUQXYCZTTZOMKDH4WA"
  },
  {
    name: "Julian van der Welle",
    address: "DPSDCMAH6Z4GXXQOFNJAFJEOT6PNRZDO4R5N7WKJD5FH77EKEPTICH4FCQ"
  },
  {
    name: "Joseph Wu",
    address: "YM7DVJVUCHAC42QPRMIX5XUPU6W2DIPU6ZNOEYTZ6Z2HISYNE4SQF5PLOA"
  },
  {
    name: "Naoki Yamamoto",
    address: "5HHP6MI64C6LJJBEUHDHBB4HZEKUI43KMMUJKJWZOLVD2FYSPFD5SOHQYA"
  }
];

// Note mapping for transaction parsing
export const NOTE_MAPPING: { [key: string]: string } = {
  'a': 'yes',
  'b': 'no', 
  'c': 'abstain'
};

export function getCandidateByNote(note: string): string | null {
  // Parse note format: "a.1" where a=vote type, 1=candidate index
  const match = note.match(/^([abc])\.(\d+)$/);
  if (!match) return null;
  
  const candidateIndex = parseInt(match[2]) - 1; // Convert to 0-based index
  
  if (candidateIndex >= 0 && candidateIndex < CANDIDATES.length) {
    return CANDIDATES[candidateIndex].name;
  }
  
  return null;
}

export function getVoteType(note: string): 'yes' | 'no' | 'abstain' | null {
  const match = note.match(/^([abc])\.\d+$/);
  if (!match) return null;
  
  const voteCode = match[1];
  return NOTE_MAPPING[voteCode] as 'yes' | 'no' | 'abstain' || null;
} 