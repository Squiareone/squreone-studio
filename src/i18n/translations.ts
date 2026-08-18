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
  /**
   * Four expertise cards: title + a short bullet list (replaced the single
   * paragraph so each card reads as scannable capability tags, matching a
   * "Digital Experience Strategy / Technology Strategy / ..." reference
   * style — also lets the four cards, read together, tell the ecosystem
   * story: brand consulting → physical/experiential design → manufacturing
   * → global delivery).
   */
  expertiseCards: { title: string; bullets: string[] }[];
  casesTitle: string;
  casesDesc: string;
  /**
   * Full-bleed "Experience" story sequence — 7 headlines, one per photo
   * step (index 0 = concept sketch, deliberately empty/no headline).
   */
  casesExperienceSteps: string[];
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
        bullets: [
          "Brand Strategy Consulting",
          "Physical Touchpoint Design",
          "Material & Cost Engineering",
          "Premium Brand Equity",
        ],
      },
      {
        title: "Brand activation",
        bullets: [
          "Offline Experience Design",
          "Spatial & Exhibition Design",
          "Community Engagement",
          "Budget-Conscious Execution",
        ],
      },
      {
        title: "Turnkey delivery",
        bullets: [
          "Prototyping & Sampling",
          "Mass Production",
          "Factory-Direct Manufacturing",
          "End-to-End Quality Control",
        ],
      },
      {
        title: "Global vision",
        bullets: [
          "Dual-Hub Sourcing",
          "Hyper-Scaled Supply Chains",
          "Cross-Border Delivery",
          "Cost Control at Scale",
        ],
      },
    ],
    casesTitle: "Cases & Scenarios",
    casesDesc:
      "Synchronized closely with your market positioning, our portfolio spans diverse physical touchpoints, ranging from high-utility brand merchandise and bespoke VIP gifts to turnkey exhibition curation for global summits.",
    casesExperienceSteps: [
      "",
      "We design from sketch.",
      "Massive production.",
      "Bring objects to life for your brand.",
      "Objects that carry your brand everywhere.",
      "Gifts for your clients and employees.",
      "Unique pieces for every exhibition.",
    ],
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
        bullets: ["品牌策略咨询", "实体触点设计", "材料与成本工程", "高端品牌资产"],
      },
      {
        title: "品牌活化",
        bullets: ["线下体验设计", "空间与展陈设计", "社群互动运营", "预算内高效执行"],
      },
      {
        title: "一站式交付",
        bullets: ["打样与样品制作", "规模化量产", "工厂直连制造", "全流程品控"],
      },
      {
        title: "全球视野",
        bullets: ["双枢纽供应链", "超规模供应网络", "跨境交付能力", "规模化成本控制"],
      },
    ],
    casesTitle: "案例与场景",
    casesDesc:
      "紧贴你的市场定位，作品覆盖多样实体触点——从高实用品牌周边、定制 VIP 礼赠，到全球峰会的一站式展览策划。",
    casesExperienceSteps: [
      "",
      "从一张手稿，开始设计。",
      "规模化量产。",
      "把周边产品带到你的品牌里。",
      "为企业设计物件，放大品牌效应。",
      "为企业客户和员工设计难忘的礼品。",
      "为展会打造独特周边产品。",
    ],
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
    langLabel: "语言",
    contact: "联系我们",
    menu: "菜单",
    menuClose: "关闭",
    menuHome: "首页",
    menuExpertise: "专业领域",
    menuCases: "案例与场景",
  },
};
