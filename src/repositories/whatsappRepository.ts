import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WhatsAppAudience {
  id: number;
  label: string;
  count: number;
}

export const WHATSAPP_AUDIENCES: WhatsAppAudience[] = [
  { id: 0, label: 'All customers', count: 312 },
  { id: 1, label: 'MVP · starred', count: 28 },
  { id: 2, label: 'Beard regulars', count: 96 },
  { id: 3, label: 'Not seen in 60 days', count: 54 },
];

export const WHATSAPP_TEMPLATES: Record<string, string> = {
  'Monthly offer':
    'Hi [name] — [offer] at [shop] this month: beard colour free with any haircut, Mon–Wed. Reply BOOK and we’ll hold your chair.',
  'Rebook nudge':
    'Hi [name], it’s been a while. Your last cut at [shop] was 6 weeks ago — shall we keep your usual Saturday slot? Reply YES and we’ll confirm.',
  'Birthday':
    'Happy birthday, [name]! From everyone at [shop] — [offer] on any service this week. Just show this message at the desk.',
};

export class WhatsAppRepository {
  getAudiences(): WhatsAppAudience[] {
    return WHATSAPP_AUDIENCES;
  }

  getTemplates(): Record<string, string> {
    return WHATSAPP_TEMPLATES;
  }

  renderPreview(templateBody: string, customerName: string, shopName: string, offer = '20% off'): string {
    return templateBody
      .replace(/\[name\]/g, customerName)
      .replace(/\[shop\]/g, shopName)
      .replace(/\[offer\]/g, offer);
  }
}

export const whatsappRepository = new WhatsAppRepository();
