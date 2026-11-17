export type Member = {
  name: string;
  role: string;
  image: string;
  linkedin: string;
};

const li = (handle: string) =>
  `https://www.linkedin.com/in/${handle}?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app`;

export const president: Member = {
  name: "Youssif Saad",
  role: "President",
  image: "/images/team/youssef.jpeg",
  linkedin: li("youssifsaad"),
};

export const generalVPs: Member[] = [
  {
    name: "Ahmed Essam",
    role: "General Vice President",
    image: "/images/team/ahmed.jpeg",
    linkedin: "#",
  },
  {
    name: "Seif Eldeen",
    role: "General Vice President",
    image: "/images/team/seif.jpeg",
    linkedin: li("seifeldeen-magdy-858b0627b"),
  },
];

export const wingVPs: Member[] = [
  {
    name: "Zeyad Hossam",
    role: "Vice President Technical",
    image: "/images/team/zeyad.jpeg",
    linkedin: li("zeyad-hossameldin"),
  },
  {
    name: "Amall Khaled",
    role: "Vice President Non-Technical",
    image: "/images/team/amall.jpeg",
    linkedin: li("amall-khaled-86a945239"),
  },
];

export const technicalDirectors: Member[] = [
  {
    name: "Abdelrahman Nader",
    role: "Technical Director",
    image: "/images/team/nader.jpeg",
    linkedin: li("abdulrahman-nader"),
  },
  {
    name: "Malak Hany",
    role: "Technical Director",
    image: "/images/team/malk.jpeg",
    linkedin: li("mallakhanyy"),
  },
];

export const nonTechnicalDirectors: Member[] = [
  {
    name: "Rawan Aziz",
    role: "Non-Technical Director",
    image: "/images/team/rawan.jpeg",
    linkedin: li("rawan-aziz-6ba807329"),
  },
  {
    name: "Haneen Borhan",
    role: "Non-Technical Director",
    image: "/images/team/hanen.jpeg",
    linkedin: li("haneen-borhan-736a22363"),
  },
];
