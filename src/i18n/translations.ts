export type Lang = "en" | "zh";

export interface Copy {
  studioName: string;
  studioShort: string;
  introWelcome: string;
  heroTitle: string;
  heroSecondary: string;
  storyTitle: string;
  detailText: string;
  expertiseTitle: string;
  expertiseTitleLine1: string;
  expertiseTitleLine2: string;
  expertiseSubtitle: string;
  /** Four expertise cards: title + body copy */
  expertiseCards: { title: string; body: string }[];
  casesTitle: string;
  casesDesc: string;
  letsWorkTitle: string;
  letsWorkSubtitle: string;
  continueScroll: string;
  contactLabel: string;
  contactHeading: string;
  contactEnquiryLabel: string;
  contactStayLabel: string;
  contactFormDescription: string;
  contactEmailPlaceholder: string;
  contactEmailLabel: string;
  contactSubmitAria: string;
  contactSocialXhs: string;
  contactFooterCopy: string;
  contactFooterTagline: string;
  scrollHint: string;
  casesEnterHint: string;
  langLabel: string;
  contact: string;
  menu: string;
  menuClose: string;
  menuHome: string;
  menuExpertise: string;
  menuCases: string;
}

export const copy: Record<Lang, Copy> = {
  en: {
    studioName: "SquareOne",
    studioShort: "SquareOne",
    introWelcome: "Welcome to SquareOne",
    heroTitle: "Shaping Brands,\nOne at a time",
    heroSecondary: "We are a design-built studio.",
    storyTitle: "Crafting uniqueness for your business.",
    detailText:
      "With an architect's rigor in material and cost, we turn everyday objects into premium budget-friendly brand pieces - making your brand not just memorable, but portable.",
    expertiseTitle: "Areas of expertise",
    expertiseTitleLine1: "AREA OF",
    expertiseTitleLine2: "EXPERTISE",
    expertiseSubtitle:
      "We bring multidisciplinary expertise to every stage - from strategy and creative to sampling, quality control, mass production, and final delivery.",
    expertiseCards: [
      {
        title: "Strategic design",
        body: "Custom engineering aligned directly with your brand marketing strategy. We inject original, powerful design into physical touchpoints to build premium brand equity.",
      },
      {
        title: "Brand activation",
        body: "Transforming brand concepts into immersive offline experiences that spark organic virality. We rethink spatial mechanics and physical interaction to build deep community connection - within budget.",
      },
      {
        title: "Turnkey delivery",
        body: "End-to-end execution from concept to mass production, taking blueprints to the factory floor. Our single-point model eliminates vendor disconnect and ensures 100% high-fidelity replication.",
      },
      {
        title: "Global vision",
        body: "Dual-hub efficiency connecting global aesthetics with hyper-scaled supply chains. We empower brands and tech giants to maximize cost control and break borders.",
      },
    ],
    casesTitle: "Cases & Scenarios",
    casesDesc:
      "Synchronized closely with your market positioning, our portfolio spans diverse physical touchpoints, ranging from high-utility brand merchandise and bespoke VIP gifts to turnkey exhibition curation for global summits.",
    letsWorkTitle: "Let's work\ntogether!",
    letsWorkSubtitle: "Is Your Big Idea Ready to Go Wild?",
    continueScroll: "CONTINUE TO SCROLL",
    contactLabel: "Contact us",
    contactHeading: "Let's craft something unique together.",
    contactEnquiryLabel: "General enquiry",
    contactStayLabel: "Stay in touch",
    contactFormDescription:
      "Leave your email to discuss your project, request our Lookbook, or receive a quick evaluation within 24 hours.",
    contactEmailPlaceholder: "your@email.com",
    contactEmailLabel: "Email",
    contactSubmitAria: "Submit email",
    contactSocialXhs: "Xiaohongshu",
    contactFooterCopy: "© 2026 SquareOne. All rights reserved.",
    contactFooterTagline: "Designed with care.",
    scrollHint: "Scroll to explore",
    casesEnterHint: "Hover or click to enter",
    langLabel: "Language",
    contact: "Let's talk",
    menu: "Menu",
    menuClose: "Close",
    menuHome: "Home",
    menuExpertise: "Areas of Expertise",
    menuCases: "Cases & Scenarios",
  },
  zh: {
    studioName: "大方",
    studioShort: "大方",
    introWelcome: "欢迎来到大方的世界",
    heroTitle: "让每一件小物，都装得下品牌",
    heroSecondary: "设计驱动,\n构建一切",
    storyTitle: "为您的品牌打造独特价值",
    detailText:
      "用建筑师的研究，打磨材质与成本的平衡；让寻常物件成为高级又实惠的品牌信物 - 你的品牌，不止被记住，还被带回家。",
    expertiseTitle: "专业领域",
    // Single line for ZH (EN keeps AREA OF / EXPERTISE on two lines)
    expertiseTitleLine1: "专业领域",
    expertiseTitleLine2: "",
    expertiseSubtitle:
      "从策略、创意、打样、品控、量产与交付，我们以多领域专业能力，贯穿每一个环节。",
    expertiseCards: [
      {
        title: "策略设计",
        body: "定制化设计工厂，与品牌影响策略直接同步。我们讲原创设计力注入品牌构筑高端资产。",
      },
      {
        title: "品牌活化",
        body: "将品牌理念转化为沉浸式线下体验，驱动用户自发传播。我们重构空间机制与实体互动，在预算内激活深度社群共鸣。",
      },
      {
        title: "一站式交付",
        body: "从概念到量产的全链路执行，让蓝图直达工厂产线。单点对接模式消除供应商断层，确保100%高保真还原。",
      },
      {
        title: "全球视野",
        body: "双枢纽高效协同，链接全球审美与超规模供应链。助力品牌与科技巨头实现极致成本控制与无界突破。",
      },
    ],
    casesTitle: "案例与场景",
    casesDesc:
      "紧贴你的市场定位，作品覆盖多样实体触点——从高实用品牌周边、定制 VIP 礼赠，到全球峰会的一站式展览策划。",
    letsWorkTitle: "合作，从这里开始",
    letsWorkSubtitle: "让你的创意，野蛮生长",
    continueScroll: "继续向下滚动",
    contactLabel: "联系我们",
    contactHeading: "携手打造独一无二的品牌载体。",
    contactEnquiryLabel: "商务与项目咨询",
    contactStayLabel: "保持联系",
    contactFormDescription:
      "留下您的邮箱，探讨项目需求、索取作品集，或在 24 小时内获取评估方案。",
    contactEmailPlaceholder: "请输入您的邮箱...",
    contactEmailLabel: "邮箱",
    contactSubmitAria: "提交邮箱",
    contactSocialXhs: "小红书",
    contactFooterCopy: "© 2026 大方. 保留所有权利。",
    contactFooterTagline: "用心设计。",
    scrollHint: "向下滚动",
    casesEnterHint: "悬停或点击进入",
    langLabel: "语言",
    contact: "联系我们",
    menu: "菜单",
    menuClose: "关闭",
    menuHome: "首页",
    menuExpertise: "专业领域",
    menuCases: "案例与场景",
  },
};
