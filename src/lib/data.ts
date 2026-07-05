// ─────────────────────────────────────────────────────────────────────────
// All site content lives here. Edit this file to update the portfolio.
// (Looking for your GitHub link? Update `socials.github` below.)
// ─────────────────────────────────────────────────────────────────────────

export const profile = {
  name: "Sai Hrushik Koppula",
  // Shown under the name in the hero.
  role: "Aspiring AI/ML Engineer",
  tagline: "MS in Computer Science @ Montclair State University",
  location: "Jersey City, NJ",
  graduating: "Graduating May 2026",
  // Short punchy line for the hero / SEO description.
  blurb:
    "I build AI-powered applications, scalable backends, and interactive software — turning complex ideas into things people can actually use.",
};

export const about = {
  // A couple of paragraphs. Plain strings, rendered as separate <p> blocks.
  paragraphs: [
    "I'm a Master's in Computer Science candidate at Montclair State University (2024–2026), focused on Artificial Intelligence, Machine Learning, and Game Development. I like working where research-y ideas meet shippable products.",
    "Right now I'm building AI-powered applications and full-stack web solutions with Python, React, and modern tooling — and going deep on Generative AI, Large Language Models, and AI agents. Before grad school I interned at AWS, where I worked with VPC and S3 to ship secure, scalable cloud infrastructure.",
    "I'm continuously sharpening my skills in system design, cloud technologies, and scalable application development. Fun fact: I genuinely enjoy transforming complex technical concepts into practical tools — if it's useful to a real person, I'm interested.",
  ],
  // Quick-hit highlights shown as a small grid.
  highlights: [
    "Generative AI, LLMs & AI Agents",
    "Backend & REST API design",
    "Cloud microservices (AWS, Azure)",
    "Game development with Unity",
  ],
};

export type Skill = { group: string; items: string[] };

export const skills: Skill[] = [
  {
    group: "Languages",
    items: ["Python", "JavaScript", "C#", "C++", "PHP", "HTML", "CSS"],
  },
  {
    group: "Frameworks & Web",
    items: ["React", "Django", "Spring Boot", "REST APIs", "Unity"],
  },
  {
    group: "AI / ML",
    items: [
      "PyTorch",
      "TensorFlow",
      "Scikit-learn",
      "Hugging Face",
      "LangChain",
      "OpenAI API",
      "NumPy",
      "Pandas",
    ],
  },
  {
    group: "Data & Vector Stores",
    items: ["MySQL", "PostgreSQL", "FAISS", "ChromaDB"],
  },
  {
    group: "Tools & Cloud",
    items: ["Git/GitHub", "Docker", "AWS", "Azure", "Postman", "VS Code", "Jupyter"],
  },
];

export type Project = {
  title: string;
  blurb: string;
  tech: string[];
  // Optional. Add a repo or live link and the card becomes clickable.
  github?: string;
  demo?: string;
};

export const projects: Project[] = [
  {
    title: "Blood Type Classification Web App",
    blurb:
      "A backend-centric platform for blood-type categorization. Designed RESTful APIs for client–server interaction, data validation, and classification, using modular, object-oriented service design for scalable communication between the frontend and server.",
    tech: ["Java", "Spring Boot", "React", "Django"],
    // github: "https://github.com/your-username/blood-type-classifier",
  },
  {
    title: "Dual-Tone Multi-Frequency (DTMF) Robot",
    blurb:
      "A command-driven robot that converts real-time signal input into physical movement. Built with modular control logic on a Raspberry Pi — a hands-on study in event-driven systems and hardware–software integration. (Also won 1st place at IT Fest.)",
    tech: ["Raspberry Pi", "Python", "Signal Processing"],
  },
  {
    title: "Car Driving Game — Multi-Perspective Levels",
    blurb:
      "A 3D driving game with first- and third-person cameras and progressively harder levels. Used OOP, game-state management, and event-driven logic to handle player controls, camera switching, and level transitions.",
    tech: ["C#", "Unity", "Game Dev"],
  },
];

export const experience = [
  {
    company: "Amazon Web Services (AWS)",
    role: "Cloud Computing Intern",
    period: "Aug 2022 – Nov 2022",
    points: [
      "Configured and managed AWS VPC and S3 to implement secure, scalable cloud solutions.",
      "Supported reliable application deployment and resilient data storage workflows.",
    ],
  },
];

export const education = [
  {
    school: "Montclair State University",
    degree: "M.S. in Computer Science",
    detail: "GPA 3.6 / 4.0 · Montclair, NJ",
    period: "2024 – 2026",
  },
  {
    school: "Sreenidhi Institute of Science and Technology",
    degree: "B.Tech in Computer Science Engineering",
    detail: "GPA 7.0 / 10.0 · Ghatkesar, Telangana",
    period: "2020 – 2024",
  },
];

export const socials = {
  email: "hrushiksai0@gmail.com",
  linkedin: "https://www.linkedin.com/in/sai-hrushik-koppula",
  github: "https://github.com/saihrushik",
  resume: "/Sai_Hrushik_Koppula_Resume.pdf",
};

// Anchor links used by the navbar.
export const navLinks = [
  { href: "#about", label: "About" },
  { href: "#skills", label: "Skills" },
  { href: "#projects", label: "Projects" },
  { href: "#experience", label: "Experience" },
  { href: "#contact", label: "Contact" },
];
