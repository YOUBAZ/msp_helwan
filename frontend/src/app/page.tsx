import Link from "next/link";
import { Award, Calendar, ChevronRight, Lock, ShieldCheck, Users } from "lucide-react";
import { stats } from "@/data/site";
import ContactList from "@/components/ContactList";
import ContactForm from "@/components/ContactForm";
import ExploreButton from "@/components/ExploreButton";
import SocialIcons from "@/components/SocialIcons";

const highlights = [
  { label: "Dynamic Community", Icon: Users },
  { label: "Skill Development", Icon: Award },
  { label: "Career Mentorship", Icon: ShieldCheck },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section
        className="relative min-h-[90vh] flex items-center text-white bg-cover bg-fixed bg-center"
        style={{ backgroundImage: "url(/images/hero-bg.jpeg)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-blue-900/80 to-transparent" />
        <div className="relative container mx-auto px-6 z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-slate-600">
              <span className="relative flex h-3 w-3">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-sm font-black uppercase tracking-wider text-slate-200">
                Board Recruitment 2026 is Closed!
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
              MSP HELWAN <br />
              <span className="text-orange-500">SEASON 26</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-200 mb-8 font-light leading-relaxed">
              We don&apos;t just teach technology; we build the next generation of leaders and
              innovators at Helwan University.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                disabled
                className="bg-slate-500 cursor-not-allowed px-10 py-4 rounded-2xl font-black transition-all flex items-center justify-center shadow-xl opacity-80 group"
              >
                APPLICATIONS CLOSED <Lock className="ml-2" size={20} />
              </button>
              <ExploreButton />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-blue-900 border-y border-blue-800">
        <div className="container mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-black text-orange-500 mb-1">{s.value}</div>
              <div className="text-xs uppercase tracking-widest opacity-60">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-24 bg-white overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2 relative">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-orange-100 rounded-full mix-blend-multiply filter blur-xl opacity-70" />
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/about.jpeg"
                alt="MSP Collaboration"
                className="relative rounded-[2.5rem] shadow-2xl border-8 border-white hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="lg:w-1/2 space-y-8">
              <div className="inline-block px-4 py-1 bg-blue-50 text-blue-900 rounded-lg text-xs font-black uppercase tracking-widest">
                About the Club
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-blue-900 tracking-tight">
                EMPOWERING STUDENTS SINCE DAY ONE.
              </h2>
              <div className="space-y-4 text-slate-600 leading-relaxed text-lg">
                <p>
                  MSP Helwan is a premier student community at Helwan University. We are a part
                  of the global Microsoft Student Partners program, dedicated to bridging the gap
                  between academic theory and industry reality.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {highlights.map(({ label, Icon }) => (
                    <div key={label} className="flex items-start gap-3">
                      <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                        <Icon size={20} />
                      </div>
                      <span className="font-bold text-sm text-slate-800">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recruitment banner */}
      <section className="py-20 bg-slate-900 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/10 skew-x-12 translate-x-1/4" />
        <div className="container mx-auto px-6 relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="text-white max-w-xl text-center md:text-left">
            <h3 className="text-3xl md:text-4xl font-black mb-4 uppercase italic">
              Recruitment Phase Finished
            </h3>
            <p className="text-slate-400 font-medium">
              The selection phase for the Season 26 High Board has officially begun. We are no
              longer accepting new applications. Good luck to all applicants!
            </p>
          </div>
          <div className="whitespace-nowrap bg-blue-900/50 text-slate-500 px-12 py-5 rounded-2xl font-black border border-slate-700">
            APPLICATIONS CLOSED
          </div>
        </div>
      </section>

      {/* Events teaser */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl font-black text-blue-900 mb-16 uppercase tracking-tight italic">
            Our Impactful Events
          </h2>
          <div className="grid md:grid-cols-1 max-w-2xl mx-auto gap-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 group hover:border-orange-500 transition-all text-left">
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 bg-blue-50 rounded-2xl text-blue-900 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <Calendar size={32} />
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Coming Soon
                </span>
              </div>
              <h4 className="text-2xl font-black text-blue-900 mb-3">Season Orientation 2026</h4>
              <p className="text-slate-500 text-sm leading-relaxed mb-6 italic">
                &quot;The first step into a world of innovation. Meet the board and discover your
                potential tracks.&quot;
              </p>
              <Link
                href="/events"
                className="inline-flex items-center gap-2 font-black text-xs text-blue-900 uppercase tracking-widest hover:text-orange-600 transition-colors"
              >
                Event Details <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto bg-blue-50 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col md:flex-row">
            <div className="md:w-1/3 bg-blue-900 p-12 text-white flex flex-col justify-between">
              <div>
                <h3 className="text-3xl font-black mb-8 uppercase tracking-tighter">
                  Get In Touch
                </h3>
                <ContactList compactEmail />
              </div>
              <div className="flex gap-4 mt-12">
                <SocialIcons className="p-3 bg-white/10 rounded-xl hover:bg-orange-600 transition-all" />
              </div>
            </div>
            <div className="md:w-2/3 p-12 bg-white">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
