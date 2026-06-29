from datetime import datetime, timezone

import config
from services.llm import generate


SYNTHESIS_SYSTEM = (
    "You are a career strategist reviewing a job seeker's rejection history. "
    "Write 2-3 concise paragraphs identifying the key patterns and what they "
    "suggest for the candidate's search strategy. Be specific, honest, and "
    "actionable. Do not use corporate language or filler phrases."
)



def _aggregate(apps_with_leads: list[dict]) -> dict:
    total = len(apps_with_leads)
    skill_gaps: dict[str, int] = {}
    by_tone: dict[str, int] = {}
    scores: list[int] = []
    goal_counts = {"aligns": 0, "neutral": 0, "detours": 0}
    stage_counts = {"before_interview": 0, "after_interview": 0, "ghosted": 0}
    entries: list[dict] = []

    for item in apps_with_leads:
        app = item["app"]
        fit = item["fit"]

        for mh in fit.get("must_haves", []):
            if mh.get("status") == "GAP":
                skill = mh.get("skill", "Unknown")
                skill_gaps[skill] = skill_gaps.get(skill, 0) + 1

        tone = app.get("company_tone") or "unknown"
        by_tone[tone] = by_tone.get(tone, 0) + 1

        score = fit.get("match_score")
        if score is not None:
            scores.append(int(score))

        alignment = fit.get("goal_alignment", "neutral")
        if alignment in goal_counts:
            goal_counts[alignment] += 1

        status = app["status"]
        if status == "Rejected":
            stage_counts["before_interview"] += 1
        elif status == "Rejected after interview":
            stage_counts["after_interview"] += 1
        elif status == "Ghosted after interview":
            stage_counts["ghosted"] += 1

        entries.append({
            "company": app.get("company", "Unknown"),
            "job_title": app.get("job_title", "Unknown"),
            "match_score": score,
            "goal_alignment_note": fit.get("goal_alignment_note", ""),
            "stage": status,
        })

    sorted_gaps = sorted(
        [{"skill": k, "gap_count": v, "out_of": total} for k, v in skill_gaps.items()],
        key=lambda x: x["gap_count"],
        reverse=True,
    )
    avg = round(sum(scores) / len(scores)) if scores else 0
    score_dist = {
        "avg": avg,
        "low": sum(1 for s in scores if s < 50),
        "mid": sum(1 for s in scores if 50 <= s <= 70),
        "high": sum(1 for s in scores if s > 70),
    }
    tone_list = sorted(
        [{"tone": k, "count": v} for k, v in by_tone.items()],
        key=lambda x: x["count"],
        reverse=True,
    )
    return {
        "entries": entries,
        "skill_gaps": sorted_gaps,
        "by_company_type": tone_list,
        "score_distribution": score_dist,
        "goal_alignment": goal_counts,
        "outcome_stage": stage_counts,
        "total": total,
    }


async def build_rejection_analysis(apps_with_leads: list[dict]) -> dict:
    agg = _aggregate(apps_with_leads)
    career_goal = config.load_career_goal()
    model = config.model("research")

    entries_text = "\n".join(
        f"- {e['company']} | {e['job_title']} | score {e['match_score']} | "
        f"{e['stage']} | {e['goal_alignment_note']}"
        for e in agg["entries"]
    )
    prompt = (
        f"Career goal:\n{career_goal}\n\n"
        f"Closed applications ({agg['total']} total):\n{entries_text}\n\n"
        f"Skill gaps (GAP frequency): {agg['skill_gaps']}\n"
        f"By company type: {agg['by_company_type']}\n"
        f"Match score distribution: {agg['score_distribution']}\n"
        f"Goal alignment breakdown: {agg['goal_alignment']}\n"
        f"Outcome stages: {agg['outcome_stage']}\n\n"
        "Write the analysis."
    )

    narrative = await generate(model, prompt, system=SYNTHESIS_SYSTEM)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total": agg["total"],
        "narrative": narrative.strip(),
        "skill_gaps": agg["skill_gaps"],
        "by_company_type": agg["by_company_type"],
        "score_distribution": agg["score_distribution"],
        "goal_alignment": agg["goal_alignment"],
        "outcome_stage": agg["outcome_stage"],
    }
