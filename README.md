# بسم الله الرحمن الرحيم
<image src="static/qadiyya_icon.png"/>

# Qaḍiyya | قضية
**Qaḍiyya** is an interactive web application for constructing, visualizing, and analyzing logical arguments in a structured, hierarchical format **inspired by the traditional science of Islamic logic [*manṭiq*]**.

**Named after the Arabic *manṭiqī* term for the proposition** (i.e. a statement that can either be true or false, used to construct rational arguments), Qaḍiyya's purpose is to make the structure of complex reasoning visible. 

**Classical *manṭiq* trains students to think in orderly, hierarchical steps, but texts rarely display these relationships in a visual way**. Qaḍiyya helps the student transform those implicit structures into clear, interactive charts; letting users see how premises connect, how sub-arguments branch, and how a conclusion necessarily emerges from its supporting statements.

### 💡 Inspiration behind Qaḍiyya
Qaḍiyya grew out of my own studies in the traditional Islamic sciences of logic [*manṭiq*], Avicennan Neoplatonism [*falsafa*], and dialectical theology [*kalām*]—especially during lessons with my teacher [Shaykh Hamza Karamali](https://hamzakaramali.com/), where we <u>regularly</u> build these detailed charts by hand, translating the rigorous philosophical arguments of luminaries like Athīr al-Dīn al-Abharī and Saʿd al-Dīn al-Taftāzānī in their works like the *Isagoge*, *Hidāyat al-ḥikma*, and *Sharḥ al-ʿaqāʾid al-nasafiyya*. 

The chart format used in Qaḍiyya is not something I invented—**it is the exact structure taught to us by Shaykh Hamza in [his courses](https://whyislamistrue.com/kalam)**, reflecting the disciplined, hierarchical reasoning of classical *manṭiq* and *kalām*.

<image src="static/screenshot.png"/>

<small>*Pictured above: a demonstration of **Qaḍiyya** using one of Athīr al-Dīn al-Abharī's positive arguments for Aristotelian hylomorphism*</small>

These charts are incredibly powerful tools: they force the student to break a proof into its smallest propositions, see exactly how each statement supports the next, and understand the inner architecture of reasoning in a way that textual explanations alone can’t provide. Not only that, but each proposition is classified as either "inferential" [*naẓarī*], meaning it requires another argument to establish, or "non-inferential" [*ḍarūrī*], meaning it does not. With the help of these charts, the student can take each argument back to its non-inferential premises, and understand where the arguments can rationally be critiqued and where they cannot.

But as the arguments grew more complex, I found myself constantly redrawing, renumbering, and reorganizing these diagrams. **I wanted a way to preserve the rigor and clarity of the method without the mechanical friction that slows down the learning process.**

**Qaḍiyya simply digitizes and streamlines the process of making these charts.** It lets students build, edit, and rearrange argument trees with ease, preserving the intellectual rigor while removing the tedium. The goal is **not** to replace deep philosophical engagement, but rather to make the process smoother, more intuitive, and more accessible—**so that the student can spend less time wrestling with formatting, and more time wrestling with ideas**.

## 🧠 Project Goals
### 1. Make argument structure visible — without replacing real thinking
Arguments often become confusing; <u>not</u> because the ideas are deep, but because the structure of the reasoning is buried, tangled, or assumed.
    
Qaḍiyya does not attempt to replace the intellectual work of analyzing or constructing arguments. Instead, it removes the friction of tracking structure manually, so that the student can focus on what actually matters: the reasoning itself.

This tool helps make arguments outwardly clear by:

- Mapping arguments into numbered premises

- Allowing unlimited levels of sub-premises

- Showing precise parent–child relationships

- Updating numbering automatically

- Displaying the whole structure in a clean, readable format

**The goal is to clarify reasoning, not automate it.**

### 2. Bring *manṭiq*-style discipline to modern argument mapping
Modern argument-mapping apps exist, but almost none capture the hierarchical rigor of classical manṭiq and kalām.

Qaḍiyya is designed to assist the student in practicing that discipline—not to replace it.

It supports:

- Hierarchical reasoning in the style of classical texts

- Categorization of statements by premise type (self-evident, empirical, transmitted, etc.)

- The habit of distinguishing levels of premises

- A structured, consistent approach to forming arguments

**It is a tool for working <u>with</u> *manṭiq*, not automating or simplifying the underlying intellectual craft.**

### 3. Provide a clean, intuitive interface that streamlines, not shortcuts
The UI is intentionally minimal so that the student’s cognitive energy goes toward thinking—not fiddling with layout.

- Add a premise with one click

- Delete a premise with one click

- Automatic renumbering

- Clear dropdown for premise type

- Responsive nested layout

**This removes mechanical distractions while preserving full intellectual engagement.**

### 4. Serve as an educational assistant for real logical study
Qaḍiyya is meant to aid learning, teaching, and research—not replace careful philosophical analysis.

It is useful for:

- Students studying classical/Islamic logic

- Madrasa instructors preparing or explaining arguments

- Researchers organizing *kalām*, *falsafa*, or *uṣūl* proofs

- Anyone who wants to strengthen clarity in reasoning

**It can be used to dissect arguments from classical texts or to construct new ones for teaching or research.**

### 5. Be extensible for future sophistication
The codebase is structured for future enhancements that support deeper study, including but not limited to:

- Export argument charts (PNG/PDF)

- Save/load argument trees

- Convert arguments to modern symbolic notation

- Collaborative editing

- A library of sample arguments

- LLM-integration in order to translate the charts into natural language arguments

- And much more!

**All expansions maintain the same principle: the tool *assists* thinking; it does <u>not</u> replace it!**

## 📦 Current Features
- Add premises or sub-premises dynamically

- Delete premises recursively

- Automatic argument & premise numbering

- Dropdown menu for setting premise type

- Clean UI for visualizing nested structure

- Flask backend with modular code

- Jinja templates for dynamic rendering

## 🏗️ Tech Stack
- Python (Flask) — backend + routing

- HTML/CSS/JS — frontend UI

- Jinja2 — dynamic rendering