// Country flag emoji mappings for World Cup 2026 teams
export const COUNTRY_FLAGS: Record<string, string> = {
  // Host nations
  'United States': '🇺🇸',
  'Mexico': '🇲🇽',
  'Canada': '🇨🇦',

  // South America
  'Argentina': '🇦🇷',
  'Brazil': '🇧🇷',
  'Uruguay': '🇺🇾',
  'Colombia': '🇨🇴',
  'Chile': '🇨🇱',
  'Peru': '🇵🇪',
  'Ecuador': '🇪🇨',
  'Paraguay': '🇵🇾',
  'Bolivia': '🇧🇴',
  'Venezuela': '🇻🇪',

  // Europe
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Spain': '🇪🇸',
  'Italy': '🇮🇹',
  'Portugal': '🇵🇹',
  'Netherlands': '🇳🇱',
  'Belgium': '🇧🇪',
  'Croatia': '🇭🇷',
  'Switzerland': '🇨🇭',
  'Denmark': '🇩🇰',
  'Sweden': '🇸🇪',
  'Poland': '🇵🇱',
  'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴�️',
  'Turkey': '🇹🇷',
  'Serbia': '🇷🇸',
  'Austria': '🇦🇹',
  'Ukraine': '🇺🇦',
  'Romania': '🇷🇴',
  'Czechia': '🇨🇿',
  'Bosnia-Herzegovina': '🇧🇦',
  'Ireland': '🇮🇪',
  'Norway': '🇳🇴',
  'Finland': '🇫🇮',
  'Greece': '🇬🇷',
  'Russia': '🇷🇺',
  'Hungary': '🇭🇺',
  'Slovakia': '🇸🇰',
  'Slovenia': '🇸🇮',
  'North Macedonia': '🇲🇰',
  'Albania': '🇦🇱',
  'Montenegro': '🇲🇪',

  // Africa
  'Nigeria': '🇳🇬',
  'Senegal': '🇸🇳',
  'Morocco': '🇲🇦',
  'Egypt': '🇪🇬',
  'Ghana': '🇬🇭',
  'Cameroon': '🇨🇲',
  'Tunisia': '🇹🇳',
  'Algeria': '🇩🇿',
  'South Africa': '🇿🇦',
  'Mali': '🇲🇱',
  'Ivory Coast': '🇨🇮',
  'Congo DR': '🇨🇩',
  'Zambia': '🇿🇲',
  'Guinea': '🇬🇳',
  'Equatorial Guinea': '🇬🇶',
  'Tanzania': '🇹🇿',
  'Cape Verde': '🇨🇻',
  'Cape Verde Islands': '🇨🇻',

  // Asia
  'Japan': '🇯🇵',
  'South Korea': '🇰🇷',
  'Saudi Arabia': '🇸🇦',
  'Iran': '🇮🇷',
  'Australia': '🇦🇺',
  'Qatar': '🇶🇦',
  'Uzbekistan': '🇺🇿',
  'Iraq': '🇮🇶',
  'United Arab Emirates': '🇦🇪',
  'China PR': '🇨🇳',
  'Jordan': '🇯🇴',
  'Oman': '🇴🇲',
  'Bahrain': '🇧🇭',
  'Palestine': '🇵🇸',
  'Korea Republic': '🇰🇷',
  'Vietnam': '🇻🇳',
  'Thailand': '🇹🇭',
  'Syria': '🇸🇾',
  'Lebanon': '🇱🇧',
  'India': '🇮🇳',
  'Kyrgyz Republic': '🇰🇬',

  // North/Central America & Caribbean
  'Costa Rica': '🇨🇷',
  'Panama': '🇵🇦',
  'Jamaica': '🇯🇲',
  'Honduras': '🇭🇳',
  'Haiti': '🇭🇹',
  'Trinidad and Tobago': '🇹🇹',
  'El Salvador': '🇸🇻',
  'Guatemala': '🇬🇹',
  'Cuba': '🇨🇺',
  'Nicaragua': '🇳🇮',
  'Bermuda': '🇧🇲',
  'Dominican Republic': '🇩🇴',
  'Suriname': '🇸🇷',
  'Guyana': '🇬🇾',

  // South/Caribbean
  'Curaçao': '🇨🇼',
  'Aruba': '🇦🇼',
  'Puerto Rico': '🇵🇷',
  'Martinique': '🇲🇶',
  'Guadeloupe': '🇬🇵',

  // Oceania
  'New Zealand': '🇳🇿',
  'Solomon Islands': '🇸🇧',
  'Fiji': '🇫🇯',
  'Papua New Guinea': '🇵🇬',
  'New Caledonia': '🇳🇨',
  'Tahiti': '🇵🇫',
};

export function getCountryFlag(teamName: string): string {
  return COUNTRY_FLAGS[teamName] || '⚽';
}

// Match status mapping from Football-Data.org to our internal status
export function mapApiStatus(apiStatus: string): 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' {
  switch (apiStatus) {
    case 'SCHEDULED':
    case 'TIMED':
      return 'scheduled';
    case 'IN_PLAY':
    case 'PAUSED':
    case 'LIVE':
      return 'live';
    case 'FINISHED':
      return 'finished';
    case 'POSTPONED':
      return 'postponed';
    case 'CANCELLED':
    case 'SUSPENDED':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}
