import sys
sys.path.insert(0, '.')

import bcrypt
if not hasattr(bcrypt, "__about__"):
    bcrypt.__about__ = type("about", (), {"__version__": getattr(bcrypt, "__version__", "4.0.0")})

if hasattr(bcrypt, "hashpw") and not getattr(bcrypt, "_hashpw_patched", False):
    _orig_hashpw = bcrypt.hashpw
    def _safe_hashpw(password, salt):
        if isinstance(password, bytes) and len(password) > 72:
            password = password[:72]
        return _orig_hashpw(password, salt)
    bcrypt.hashpw = _safe_hashpw
    bcrypt._hashpw_patched = True

from backend.core.database import engine, Base, SessionLocal, migrate_sqlite_schema
from backend.models import Student, Resource, Event, SeniorJourney, TaskLog, PlannerEvent, DeadlineSubtask
from passlib.context import CryptContext
from datetime import datetime, timedelta

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    clean_pw = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.hash(clean_pw)

def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    migrate_sqlite_schema()
    print("Tables created.")

    db = SessionLocal()

    try:
        if db.query(Student).count() > 0:
            print("Database already initialized. Skipping...")
            return

        print("Seeding sample data...")
        student1 = Student(
            roll_number="21001001",
            name="Amit Patel",
            email="amit.patel@iitb.ac.in",
            password_hash=hash_password("password123"),
            branch="Computer Science",
            year=4,
            domains="sde,ai_ml",
            goals="placements,research",
            weak_subjects="DBMS,CN",
            study_hours_per_week=35,
            cpi=8.5,
            sleep_hours=7.0,
            screen_time_hours=6.0
        )

        student2 = Student(
            roll_number="21001002",
            name="Priya Sharma",
            email="priya.sharma@iitb.ac.in",
            password_hash=hash_password("password123"),
            branch="Electrical",
            year=3,
            domains="research,core",
            goals="research,phd",
            weak_subjects="Signals,Circuits",
            study_hours_per_week=25,
            cpi=8.5,
            sleep_hours=7.0,
            screen_time_hours=6.0
        )

        db.add_all([student1, student2])
        db.commit()

        resources = [
            # SDE Resources
            Resource(
                title="Striver's A2Z DSA Course",
                description="Complete DSA preparation course from basics to advanced. Covers arrays, strings, trees, graphs, DP and more.",
                url="https://takeuforward.org/",
                domain="sde",
                course="CS 101",
                resource_type="course",
                upvotes=156,
                is_curated=True
            ),
            Resource(
                title="System Design Primer",
                description="Deep dive into system design concepts: scalability, load balancing, caching, sharding.",
                url="https://github.com/donnemartin/system-design-primer",
                domain="sde",
                course="CS 301",
                resource_type="article",
                upvotes=98,
                is_curated=True
            ),
            Resource(
                title="NeetCode 150 - LeetCode Roadmap",
                description="Curated list of 150 LeetCode problems organized by topic. Best for systematic interview prep.",
                url="https://neetcode.io/",
                domain="sde",
                resource_type="tool",
                upvotes=142,
                is_curated=True
            ),
            # AI/ML Resources
            Resource(
                title="Stanford CS229 Machine Learning",
                description="Comprehensive ML course by Andrew Ng. Covers regression, classification, neural networks, SVMs.",
                url="https://cs229.stanford.edu/",
                domain="ai_ml",
                course="AI 601",
                resource_type="course",
                upvotes=134,
                is_curated=True
            ),
            Resource(
                title="Fast.ai Practical Deep Learning",
                description="Free course making deep learning accessible. Great for hands-on projects with PyTorch.",
                url="https://fast.ai/",
                domain="ai_ml",
                resource_type="course",
                upvotes=87,
                is_curated=True
            ),
            Resource(
                title="3Blue1Brown Neural Networks",
                description="Beautiful visual explanations of neural networks, backpropagation, and gradient descent fundamentals.",
                url="https://www.3blue1brown.com/topics/neural-networks",
                domain="ai_ml",
                resource_type="video",
                upvotes=112,
                is_curated=True
            ),
            # Finance Resources
            Resource(
                title="Zerodha Varsity",
                description="Complete guide to Indian stock markets. Covers fundamentals, technical analysis, options, and derivatives.",
                url="https://zerodha.com/varsity/",
                domain="finance",
                resource_type="course",
                upvotes=89,
                is_curated=True
            ),
            Resource(
                title="MIT OCW Finance Theory",
                description="MIT's introductory finance course covering valuation, risk, portfolio theory, and CAPM.",
                url="https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/",
                domain="finance",
                course="FN 201",
                resource_type="course",
                upvotes=56,
                is_curated=True
            ),
            Resource(
                title="QuantLib Python Tutorials",
                description="Hands-on tutorials for quantitative finance using Python. Pricing models, risk analysis, Monte Carlo.",
                url="https://www.quantlib.org/",
                domain="finance",
                resource_type="tool",
                upvotes=34,
                is_curated=True
            ),
            # Core Engineering Resources
            Resource(
                title="Core Engineering Handbook",
                description="Essential concepts for core engineering: thermodynamics, fluid mechanics, strength of materials.",
                domain="core",
                course="ME 101",
                resource_type="book",
                upvotes=45,
                is_curated=True
            ),
            Resource(
                title="NPTEL Core Engineering Courses",
                description="IIT professors' video lectures on mechanical, civil, electrical core subjects. Free certification available.",
                url="https://nptel.ac.in/",
                domain="core",
                resource_type="course",
                upvotes=72,
                is_curated=True
            ),
            Resource(
                title="Engineering Fundamentals - Signals & Systems",
                description="Comprehensive notes on signals, systems, Fourier transforms, and Laplace transforms for EE students.",
                domain="core",
                course="EE 201",
                resource_type="notes",
                upvotes=38,
                is_curated=True
            ),
            # Research Resources
            Resource(
                title="Research Paper Writing Guide",
                description="How to write a good research paper: structure, citations, figures, revision tips.",
                url="https://www.cs.columbia.edu/~hgs/etc/writing.html",
                domain="research",
                resource_type="article",
                upvotes=67,
                is_curated=True
            ),
            Resource(
                title="How to Read a Paper - S. Keshav",
                description="The classic 3-pass method for reading research papers efficiently. Essential for any researcher.",
                url="https://web.stanford.edu/class/ee384m/Handouts/HowtoReadPaper.pdf",
                domain="research",
                resource_type="article",
                upvotes=91,
                is_curated=True
            ),
            Resource(
                title="Connected Papers",
                description="Visual tool to explore academic papers and find related work. Great for literature surveys.",
                url="https://www.connectedpapers.com/",
                domain="research",
                resource_type="tool",
                upvotes=78,
                is_curated=True
            ),
            # Consulting Resources
            Resource(
                title="Case Interview Prep - Victor Cheng",
                description="Gold standard for consulting case interview preparation. Frameworks, practice cases, and tips.",
                url="https://www.caseinterview.com/",
                domain="consulting",
                resource_type="course",
                upvotes=65,
                is_curated=True
            ),
            Resource(
                title="McKinsey Problem Solving Game Guide",
                description="Strategies and practice for the McKinsey Imbellus digital assessment used in consulting recruitment.",
                domain="consulting",
                resource_type="article",
                upvotes=48,
                is_curated=True
            ),
            Resource(
                title="Crafting Cases - Free Frameworks",
                description="Free consulting frameworks and case walkthroughs. Market sizing, profitability, and M&A cases.",
                url="https://craftingcases.com/",
                domain="consulting",
                resource_type="course",
                upvotes=52,
                is_curated=True
            ),
        ]
        db.add_all(resources)

        events = [
            Event(
                title="CP Workshop: Advanced Algorithms",
                description="Hands-on workshop on advanced algorithms including segment trees, BIT, and divide and conquer optimization.",
                event_date=datetime.now() + timedelta(days=7),
                location="LC 101, IIT Bombay",
                domain="sde",
                organizer="Programming Club"
            ),
            Event(
                title="Research Talk: Path to PhD",
                description="Seniors share their journey to top PhD programs. Q&A session included.",
                event_date=datetime.now() + timedelta(days=14),
                location="VM 204, IIT Bombay",
                domain="research",
                organizer="Academic Council"
            ),
            Event(
                title="ML Bootcamp: Deep Learning",
                description="4-hour intensive bootcamp on PyTorch and deep learning fundamentals. Limited seats.",
                event_date=datetime.now() + timedelta(days=3),
                location="CSE Lab 2",
                domain="ai_ml",
                organizer="AI/ML Club"
            ),
        ]
        db.add_all(events)

        journeys = [
            SeniorJourney(
                author_id=1,
                title="My Google Interview Journey",
                domain="sde",
                content="""Started preparing 6 months before placements. Here's my journey:

Month 1-2: Focused on fundamentals - arrays, strings, sorting, searching. Solved 100 easy LeetCode problems.

Month 3-4: Moved to medium problems. Topics covered: linked lists, trees, graphs, dynamic programming. Solved 80 medium problems.

Month 5: System design prep. Read Grokking System Design. Did mock interviews on Pramp.

Month 6: Applied aggressively. Got interview calls from Google, Amazon, Microsoft. Google interview was 4 rounds.

Key tips:
1. Consistency matters more than quantity
2. Always explain your approach before coding
3. Don't panic when stuck - communicate with interviewer
4. Review each failed problem thoroughly

Result: Selected at Google, Bangalore.""",
                year_completed=2025,
                tags="placements,google,sde,interview-prep",
                upvotes=234,
                is_verified=True
            ),
            SeniorJourney(
                author_id=2,
                title="From On-Campus Setbacks to Product Strategy at Revolut (London) & PPO",
                domain="finance",
                content="""We begin this series with Jubin Singh, a 4th-year student from the Department of Chemical Engineering at IIT Bombay, whose career path did not unfold as expected initially, but eventually became a story of growth, clarity, and resilience.

📌 Brief Overview & Career Trajectory
• On-Campus Season: Secured shortlists for 6 to 7 top-tier Week 1 companies, but got rejected in final rounds. Initially accepted an internship at BatterySmart.
• In-Sem Role at Groww: Dissatisfied and seeking more exposure, he landed an in-semester role at Groww (broker/investor platform) via external apping, working from March through July while managing full-time academics.
• Off-Cycle Breakthrough: Apped externally again in February and secured a Product Strategy Internship at Revolut (FinTech, London) — comparing its caliber to a Day 1/2 company — and later converted it into a Pre-Placement Offer (PPO)!

💔 What Did the Season Feel Like at the Start?
"Getting shortlisted for 6-7 top companies but getting rejected in the second-to-last or final round by the end of September was worse than not getting shortlisted at all. Initially, I couldn't figure out what was going wrong."

🔥 What Kept You Going & Tough Times?
"The toughest part was reaching the final stage every single time and not converting, which made me question my approach. But I had an inner motivation to 'always push for more' and get better exposure. I knew I only needed that one 'YES' despite an infinite number of rejections."

🧠 Academics & Credit Management
"Knowing Chemical Engineering in 4th/5th semester can be hectic, I specifically kept my 5th semester lighter on academic workload — taking only core credits and avoiding electives. My strategy for core subjects was to skim content regularly and do focused revision a day or two before exams."

💡 Mental Health & Peer Comparison
"While it was initially disappointing to see friends getting interned before me, I was genuinely happy for them. Ultimately, I realized I should compete only with myself and focus on my own journey."

🚀 External Apping Strategies & Learnings
1. Direct Outreach: Reached out directly to senior management for corporate roles and professors for research/B-school projects.
2. Off-Cycle Programs: Applied early to structured off-cycle programs (Groww, Lenskart, Revolut) starting Feb/March.
3. Continuous Case Prep: Never stopped doing case studies even after on-campus rejections. The continuous practice gave a huge edge during Revolut's case interview rounds.

👑 Seniors & Mentors Who Guided Him
A big shoutout to seniors Harshit Porwal (Civil Engineering) for keeping him motivated during his lowest phases and Dev Parekh (Chemical Engineering) for continuous guidance.

💬 Advice for Juniors
• "Learn from your mistakes. Repeating the same mistake is a fault on one's own end."
• "Focus strictly on what you can control — preparation, case practice — and tune out negative talk or industry rumors."
• "Don't rely solely on on-campus hiring. Look at In-Sem internships, B-school projects, or external apping. Go all in!" """,
                year_completed=2025,
                tags="product-strategy,fintech,revolut,groww,in-sem,off-cycle,case-prep,ppo",
                upvotes=312,
                is_verified=True
            ),
            SeniorJourney(
                author_id=2,
                title="From 0 to Research Internship at MIT",
                domain="research",
                content="""How I got a research internship at MIT in my 3rd year.

The journey started with cold emailing professors in my 2nd year. I sent about 30 emails, got 5 responses, 2 were positive.

What worked for me:
1. Built a strong foundation in my area (Computer Vision)
2. Did 2 projects with professors at IITB
3. Wrote a concise, specific email explaining why their research interested me
4. Had a personal website showcasing my work

Timeline:
- Jan: Started emailing professors
- Mar: First positive response from MIT professor
- Apr: Interview and acceptance
- May-Aug: Internship at MIT

Key advice: Start early, be genuine, and don't be discouraged by rejections.""",
                year_completed=2024,
                tags="research,internship,mit,phd",
                upvotes=189,
                is_verified=True
            ),
            SeniorJourney(
                author_id=1,
                title="Building a Path of Her Own: From Gradual Exploration to Investment Banking & Arcana",
                domain="finance",
                content="""In this edition, we feature Aarushi Agarwal, a fifth-year Dual Degree student from the Department of Electrical Engineering. Her journey, from an uncertain start to a Nomura investment banking internship and a final placement at Arcana, is a story of gradual self-discovery, quiet perseverance, and the courage to build a path entirely her own.

📌 Brief Overview & Trajectory
• Year 1 (Online): Arrived on campus in her second year without the usual early exposure or peer networks.
• Year 2: Explored various fields. Joined E-Cell, attended the P&G Spotlight program, and did a VC internship at Eagle Wings (which she extended to 6 months).
• Year 3: Interned at ClearTax in the Founder’s Office, gaining experience in business strategy and operations.
• Year 4: Focused on external/personal apping. Reached out to alumni and industry professionals, landing an Investment Banking internship at Nomura.
• Year 5 (Placements): Faced a challenging placement season with Day 1 shortlists that did not immediately convert. Stayed resilient and secured a placement at Arcana through PT Cell.

💔 What Did the Season Feel Like at the Start?
"I didn’t know what non-tech applications even looked like. I thought I’d figure it out, but the season moves fast, and I hadn’t really prepared for it."
Because her first year was online, Aarushi started her second year without the informal networks that help most students understand their options early. With most Electrical batchmates oriented toward tech, she had to navigate a difficult phase of self-reflection to figure out what she actually wanted.

🔥 Journey & Key Milestones
• Eagle Wings VC (Year 2 Summer): Started as operational work, but she extended it to six months, contributing to pitch decks and portfolio reviews. This clicked as her first proper look into finance and startups.
• P&G Spotlight Programme: Though she didn't get through, the competitive selection process in Hyderabad clarified her interest in leadership, strategy, and roles engaging with people and ideas.
• E-Cell Involvement: Cultivated perspective on startup culture, building things, and career choices.
• ClearTax Founder's Office (Year 3 Summer): Worked on business strategy and operations, building tangible skills and business insights.
• Nomura Investment Banking (Year 4): Secured an internship through disciplined external apping, consistently reaching out to alumni and professionals from August through November.

⚡ The Toughest Part
Without hesitation, she points to the final placement season. Arriving at Day 1 with multiple shortlists but not converting any of them initially was a heavy weight to carry while others were getting placed.
"You do everything right, and the results still don’t come immediately. That’s a hard thing to sit with."
However, she notes that the uncertainty of her earlier years was its own kind of difficult. By the final year, she at least had the self-knowledge and clarity of what she wanted.

💪 What Kept You Going?
• Peers & Friends: They were central throughout the process—checking in, keeping things light, and constantly reminding her that her time would come.
• Direct Senior Outreach: She reached out to senior alumni on LinkedIn and Instagram. One senior’s framing stayed with her: "If one road is closed, there is always another. You just have to prepare for the next one."
• DAMP Mentor: A B.Tech senior who provided steady guidance from the 3rd through the 4th year.
• Father's Advice: "He told me it might feel like every road is blocked, but you can work on yourself, focus on one thing, and make your own way. You don’t have to follow anyone else’s route."

💡 External Apping Strategies & Learnings
1. Target Experienced Alumni: Reached out to seniors who were 3-6 years ahead rather than just 1 year ahead, as they have a more mature perspective on their fields.
2. Ask Deeper Questions: Instead of asking "how do I get this role", she asked "why did you choose this field, and how does it feel now?"
3. Value-First Outreach: Shifted from emails asking for help/referrals to emails highlighting what she could offer.

💬 Advice to Juniors
• "Second year is the best time to genuinely explore, not just apply to things because everyone else is. Find out where your interest actually lies, and then go deep on that."
• "On-campus recruitment is only one part of the picture. There are far more opportunities outside: external apping, university internships, professor projects. These are real paths, not fallbacks."
• "Close the blog after you’ve checked your roll number. Focus entirely on yourself. Other people’s timelines say nothing about yours."
• "There will be moments where it feels like every road is closed, but you can always make your own way. You don’t need to follow anyone else’s route to get somewhere worth going." """,
                year_completed=2025,
                tags="finance,investment-banking,nomura,arcana,external-apping,placements",
                upvotes=245,
                is_verified=True
            ),
            SeniorJourney(
                author_id=2,
                title="Navigating the Waiting Phase: Resilience and a Preparedness-First Mindset in Civil Engineering",
                domain="core",
                content="""In this edition, we feature Tanishka Yadav, a fourth-year B.Tech student from the Department of Civil Engineering, whose internship journey was shaped by patience, resilience, and a strong sense of perspective.

📌 Brief Overview & Mindset
Like many students navigating the internship season, Tanishka knew that the process would come with its own uncertainties. While others around her began securing shortlists and offers, she found herself navigating a phase that required patience and persistence. Instead of letting the uncertainty overwhelm her, she focused on preparation and maintaining a steady mindset throughout the season.
Going into the internship season, Tanishka adopted what she calls a “preparedness-first” mindset. She understood that the timeline of opportunities can vary from person to person, and she made a conscious decision to stay patient, self-aware, and ready for whatever opportunity came her way. Rather than getting caught up in comparisons, she chose to channel her energy into preparation.

💔 Overcoming Rejection
Like many students, she had a “dream” company — one where she believed she would be a great fit. However, when the shortlist was released, her name wasn’t on it. That moment became an important reality check.
It made her realize the danger of romanticizing roles or assuming that a particular opportunity is guaranteed. Instead of dwelling on the disappointment, she shifted her mindset from asking “Why not me?” to focusing on “What’s next?” Accepting rejection quickly, she found, helped her move forward with clarity and focus. Over time, she realized that maintaining a positive temperament isn’t just helpful during the season — it is one of the most important tools for navigating its pressures.

⚡ The Toughest Part
For Tanishka, the hardest part wasn’t preparation — it was the waiting. Watching peers receive shortlists and selections while her own journey was still unfolding tested her patience. Learning to handle that uncertainty without letting it affect her confidence became one of the biggest challenges she faced.

🔥 The Turning Point
The turning point came when she consciously shifted her mindset from anxiety about results to focusing entirely on preparation. By committing to a preparedness-first approach, she was able to stay grounded and maintain control over the aspects of the process that were within her reach.

💪 What Kept You Going?
• Parents: A quick daily call to her parents became her reset button. They constantly reminded her that stress solves nothing and that things often unfold at the right time.
• Friends & Wingmates: They didn’t just offer encouragement — they showed up for her consistently. Before interviews, they would look her in the eye and say, “It’s going to be LEGENDARY.” After interviews, regardless of the outcome, she would return to find them waiting — with snacks, conversations, and the space to process the day. Whether it was a moment of celebration or disappointment, their presence ensured she never felt alone.
• Seniors: Her seniors at E-Cell also played a key role in helping her stay confident and focused throughout the season.

💬 Advice to Juniors
• "If I could tell a junior one thing, it would be this — don’t let the worry of the result ruin the interview."
• Many capable students underperform not because they lack preparation, but because anxiety about the outcome takes over in the moment.
• "When you sit across from an interviewer, remember that they are often there to help you. Stay calm, stay present, and make the most of that window."
• Emphasize the importance of accepting rejections quickly and moving forward, rather than dwelling on missed opportunities.

🧠 Key Learnings
• Celebrating small wins.
• Staying productively engaged instead of overthinking.
• Maintaining confidence even when results were uncertain.
• Channeling anxiety into preparation rather than panic.

✨ Final Remarks
In the end, the internship did come. But for Tanishka, the most meaningful takeaway wasn’t just the offer — it was the resilience she built along the way. The waiting, the uncertainty, and the setbacks shaped her mindset in ways that immediate success never could have. More importantly, the friendships and support system that stood by her became one of the most valuable parts of the journey. Because sometimes, what we gain from the process matters far more than the outcome itself. """,
                year_completed=2025,
                tags="internship,resilience,civil-engineering,mindset,patience",
                upvotes=180,
                is_verified=True
            ),
            SeniorJourney(
                author_id=2,
                title="Overcoming CPI Hurdles: Navigating ML Research & Securing Qure.ai Externally",
                domain="ai_ml",
                content="""In this second edition, we feature Shahu Patil, a fourth-year student from the Department of Mechanical Engineering, whose path through internships and placements was far from straightforward. What began with uncertainty and unmet expectations gradually evolved into a journey of self-discovery, resilience, and renewed direction.

📌 Brief Overview & Trajectory
By his fifth semester, Shahu decided to pursue one of two goals: securing an ML Research/Data Science role or having a Software Developer role as a backup. Despite intense DSA preparation (solving 350–400 questions) and strong technical skills, a low CPI was a major block. This resulted in rejections from SDE roles during tests even when his test scores were very good.
He focused on external apping to his ideal company, Qure.ai. By taking follow-ups and ultimately acing a rigorous selection process, which included a challenging research paper round, he secured the internship in late December and eventually received a Pre-Placement Offer (PPO).

💔 What Did the Season Feel Like at the Start?
The start of the season, particularly around September, was disappointing. Despite being well-prepared on the SDE side, he was not shortlisted for interviews at top companies, even though he excelled in the tests.
He felt the process was "a little unfair" because his strong test performance wasn’t enough to overcome his lower CPI. In this period, he realized that companies were favoring CPI over test scores for SDE roles, which he found to be a major flaw in the process, especially for non-core roles.

🔥 The Turning Point
The turning point was when he received a reply from Qure.ai in November. This was the first breakthrough after consistent follow-ups. Seniors recommended him as a perfect fit for the company since his interests aligned closely with Qure.ai's medical imaging work.

💪 Overcoming Comparisons & Setbacks
He maintained patience. He says, “Time was never an issue for me. I knew that this does not make any sense. An early intern is not necessarily a good intern, for sure.” He was confident in his abilities and understood that the system is not perfect, so he avoided self-doubt and comparison.
He had a deep confidence and passion for ML Research. His motivation for working at Qure.ai was not primarily about money, but about the personal motivation of building a product for early lung cancer detection and making healthcare accessible in rural areas.

👥 Support & Commitments
• Family & Friends: His mother was concerned seeing him struggle for the first time, but he reassured her. His friends were extremely supportive throughout.
• Seniors & Mentors: He actively took advice from seniors for company-specific information.
• Managing Commitments: Leading WNCC as a Manager enhanced his profile and public speaking skills. He applied for the GSTA position after securing the Qure.ai internship in late December, confident in his ability to get a PPO because the work aligned perfectly with his passion.
• Backup Plan: If Qure.ai hadn't worked out, he had a backup plan of doing an In-Sem internship with a professor working on ML in healthcare problems.

💬 Advice to Juniors
• "Reconsider yourself if you are consistently not able to perform well in tests. One must consider asking oneself if they are truly skilled or if they are just following the market."
• "Have Patience and Focus if you are sure of your interest and skills. Patience is the key."
• "On the intern blog, simply CTRL-F and find your roll number, and if it’s not there, close the blog and don’t look at others. Focus entirely on your own journey, because there’s a lot to come."
• "Do not fake anything in your resume. Being able to explain everything you’ve written with confidence is key. For technical profiles, interviews primarily focus on the work you have done and its relevance to the company."

💡 External Apping Strategy
His strategy was highly targeted. Instead of mass-emailing, he applied to only one company, Qure.ai, as it was the most ideal fit for his profile, and followed up consistently to ensure his resume was reviewed.

✨ Final Remarks
"The intern seasons are kind of overhyped. A lot of times because of this, we forget that we are in IITB. We come so far in this race that we forget that we have achieved a lot of our childhood goals; be grateful for all that. Stay consistent. Patience is the most important thing you’ll ever require in the intern season or even in placements. You should not panic. There should be a little acceptance sometimes; don’t blame others." """,
                year_completed=2025,
                tags="ml-research,qure-ai,external-apping,low-cpi,resilience,mechanical-engineering",
                upvotes=210,
                is_verified=True
            ),
        ]
        db.add_all(journeys)

        tasks = [
            TaskLog(
                student_id=1,
                title="Complete Graph Algorithms chapter",
                description="Study dijkstra, bellman-ford, floyd-warshall",
                domain="sde",
                priority=1,
                estimated_hours=4,
                completed=True,
                actual_hours=4.5
            ),
            TaskLog(
                student_id=1,
                title="CS224n Assignment 3",
                description="Word vectors and neural networks",
                domain="ai_ml",
                priority=2,
                estimated_hours=3,
                completed=True,
                actual_hours=3.5
            ),
            TaskLog(
                student_id=1,
                title="System Design reading",
                description="Read chapter 5 on Caching",
                domain="sde",
                priority=3,
                estimated_hours=2,
                due_date=datetime.now() + timedelta(days=2)
            ),
            TaskLog(
                student_id=1,
                title="Practice mock interview",
                description="Pramp session scheduled",
                domain="sde",
                priority=1,
                estimated_hours=1.5,
                due_date=datetime.now() + timedelta(days=1)
            ),
        ]
        db.add_all(tasks)

        planner_events = [
            PlannerEvent(
                userId=1,
                title="CS301 Assignment 2",
                description="Database implementation and query optimization lab assignment",
                date=datetime.now() + timedelta(days=3),
                startTime="10:00",
                endTime="12:00",
                tag="CRITICAL",
                category="EXAM",
                deadline_date=datetime.now() + timedelta(days=3),
                deadline_label="Assignment 2",
            ),
            PlannerEvent(
                userId=1,
                title="EE201 Lab Project",
                description="Signal processing design project submission",
                date=datetime.now() + timedelta(days=6),
                startTime="14:00",
                endTime="17:00",
                tag="IMPORTANT",
                category="CLASS",
                deadline_date=datetime.now() + timedelta(days=6),
                deadline_label="Lab Report",
            )
        ]
        db.add_all(planner_events)
        db.commit()

        subtasks = [
            DeadlineSubtask(deadline_id=planner_events[0].id, title="Implement B-Tree index structure", is_completed=True, order=1),
            DeadlineSubtask(deadline_id=planner_events[0].id, title="Write SQL benchmark queries", is_completed=False, order=2),
            DeadlineSubtask(deadline_id=planner_events[0].id, title="Format final report PDF", is_completed=False, order=3),
            DeadlineSubtask(deadline_id=planner_events[1].id, title="Collect oscilloscope readings", is_completed=True, order=1),
            DeadlineSubtask(deadline_id=planner_events[1].id, title="Plot frequency response graph", is_completed=False, order=2),
        ]
        db.add_all(subtasks)

        db.commit()
        print("Sample data seeded successfully!")
        print("\nTest accounts:")
        print("  Roll: 21001001, Password: password123 (4th year, CS)")
        print("  Roll: 21001002, Password: password123 (3rd year, Electrical)")

    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
