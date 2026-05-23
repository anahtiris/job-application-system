import os
import sys
from docx import Document
from datetime import datetime

def generate_cover_letter(template_path, output_path, job_title, company_address, date_str, greeting, paragraphs):
    doc = Document(template_path)
    
    # We will search for specific anchor texts in the template and replace them
    # Anchor 1: "Bewerbung als Data & AI Engineer"
    # Anchor 2: "München, 24.04.2026"
    # Anchor 3: "Sehr geehrte Damen und Herren,"
    
    replacements = {
        "Bewerbung als Data & AI Engineer - Ontologies & Knowledge Graphs": f"Bewerbung als {job_title}",
        "München, 24.04.2026": f"München, {date_str}",
        "Sehr geehrte Damen und Herren,": greeting
    }
    
    body_started = False
    paragraphs_to_remove = []
    
    for para in doc.paragraphs:
        # Check standard replacements
        for k, v in replacements.items():
            if k in para.text:
                para.text = para.text.replace(k, v)
                
        # To replace the body, we identify the greeting and the sign-off
        if "Sehr geehrte" in para.text or greeting in para.text:
            body_started = True
            # Add the new paragraphs right after the greeting
            for p_text in reversed(paragraphs):
                new_p = para.insert_paragraph_before(p_text)
                new_p.style = para.style
            continue
            
        if "Mit freundlichen Grüßen" in para.text:
            body_started = False
            continue
            
        if body_started:
            # We are inside the old body, remove its text
            para.text = ""

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(output_path)
    print(f"Saved {output_path}")

if __name__ == "__main__":
    template = "templates/cover-letter/Cover Letter Sample.docx"
    output = "../Application/Orizon/Cover_Letter.docx"
    
    job_title = "KI Softwareentwickler (m/w/d)"
    address = "Orizon GmbH\nUnit Aviation\nz. Hd. Herr Kalkan\nHerzog-Heinrich-Straße 23\n80336 München"
    date_str = datetime.now().strftime("%d.%m.%Y")
    greeting = "Sehr geehrter Herr Kalkan,"
    
    body = [
        "die von Ihnen ausgeschriebene Position für einen Kunden aus der Luft- und Raumfahrttechnik bietet genau das Innovations- und Sicherheitsumfeld, in dem ich meine Expertise im Bereich KI-Architekturen optimal einbringen kann. Als Fullstack Software Engineer mit einem starken Fokus auf RAG-Systeme und KI-Tooling bin ich hochmotiviert, die Entwicklungsprozesse in Ihrem Tech-Cluster strategisch voranzutreiben und effizienter zu gestalten.",
        "In meiner aktuellen Rolle bei Blackatz Hub Co. Ltd. verantworte ich die Entwicklung eines KI-gestützten Wissensabrufsystems (RAG) für medizinische Gerätedokumentationen. Dabei habe ich nicht nur die zugrunde liegenden LLM-Architekturen implementiert, sondern auch die Integration von Code-Assistenz-Tools optimiert, um API-Kosten zu senken und präzise Ergebnisse zu liefern. Zudem bringe ich aus meiner langjährigen Tätigkeit als Senior Software Engineer bei der Deutschen Telekom MMS tiefgehende Erfahrung in sicheren, stark regulierten Enterprise-Umfeldern mit (z. B. Docker, Kubernetes, Concourse CI/CD). Dadurch bin ich bestens vertraut mit den Anforderungen an Security- und Compliance-Vorgaben, wie der Vermeidung von IP-Leakage-Risiken.",
        "Ich freue mich darauf, Ihr Team bei der Evaluierung und Einführung von Tools wie Cursor oder GitHub Copilot sowie bei der Implementierung von Multi-Agent-Systemen tatkräftig zu unterstützen. Für ein Vorstellungsgespräch stehe ich Ihnen gerne zur Verfügung. Mein frühestmöglicher Eintrittstermin ist der 01.07.2026."
    ]
    
    # We can also add the address just above the date if possible, but let's stick to the simplest replacement first.
    generate_cover_letter(template, output, job_title, address, date_str, greeting, body)
