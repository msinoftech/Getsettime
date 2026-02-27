// WhatsApp API Types
export interface WhatsAppTemplateParameter {
    type: "text" | "currency" | "date_time" | "image" | "document" | "video";
    text?: string;
    currency?: {
      fallback_value: string;
      code: string;
      amount_1000: number;
    };
    date_time?: {
      fallback_value: string;
    };
    image?: {
      link: string;
    };
    document?: {
      link: string;
    };
    video?: {
      link: string;
    };
  }
  
  export interface WhatsAppTemplateComponent {
    type: "header" | "body" | "button";
    parameters?: WhatsAppTemplateParameter[];
    sub_type?: "url" | "quick_reply";
    index?: number;
  }
  
  export interface WhatsAppBulkRecipient {
    phone: string;
    messageType: "template" | "text";
    templateName?: string;
    languageCode?: string;
    templateParams?: WhatsAppTemplateComponent[];
    message?: string;
  }
  
  export interface WhatsAppBulkResponse {
    success: boolean;
    total: number;
    successful: number;
    failed: number;
    results: Array<{
      phone: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }>;
  }