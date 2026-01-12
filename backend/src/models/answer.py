import groq
from typing import Any
import os

api_key = os.getenv("grok_api")

def generate_answer_from_matches(
    query: str,
    results,
    api_key= api_key,
    min_score_threshold: float = 0.12
) -> str:
    """
    Generate answer using FREE Groq API based on search results.
    
    Args:
        query: The user's question/query
        results: List of result dictionaries with structure:
                 {
                     'match': {...},
                     'is_match': bool,
                     'matches': list of matches,
                     'matcher_score': float,
                     'score': float,
                     'name': str (filename),
                     'original_filename': str,
                     ...
                 }
        api_key: Groq API key (or set GROQ_API_KEY env variable)
        min_score_threshold: Minimum score to consider relevant
    
    Returns:
        str: Generated answer or problem statement
    """
    # Filter and collect relevant matches
    relevant_matches = []
    
    for result in results:
        # Check if it's a match
        doc = result
        result = result['match'] if 'match' in result else result
        if result is None:
            is_match = False
        else:
            is_match = bool(result.is_match)
        
        if is_match:
            # Get matches array
            matches = result.matches 
            
            # Get score (could be 'score' or 'matcher_score')
            score = result.evidence.score
            
            # Get filename for context - prioritize original_filename
            filename = doc['original_filename'] if 'original_filename' in doc else doc.get('name', 'unknown')
            
            if score >= min_score_threshold:
                # Extract text from matches
                for match in matches:
                    if isinstance(match, dict):
                        # If match has text field
                        if match.get('score', 0) >= min_score_threshold:  
                            text = match.get('context', str(match))
                            relevant_matches.append({
                                'text': text,
                                'filename': filename,
                                'score': score
                            })
                    else:
                        text = str(match)
                        if match.score >= min_score_threshold:
                            text = match.context
                            relevant_matches.append({
                                'text': text,
                                'filename': filename,
                                'score': match.score
                            })
    
    # Sort by score (highest first)
    relevant_matches.sort(key=lambda x: x['score'], reverse=True)
    
    # Handle case with no matches
    if not relevant_matches:
        return (
            "I couldn't find an answer to your query. "
            "The search didn't return any relevant information from the documents."
        )
    
    # Build context for the AI with clear file references
    context_parts = []
    unique_filenames = []
    
    for idx, match in enumerate(relevant_matches[:10], 1):  # Limit to top 10
        filename = match['filename']
        if filename not in unique_filenames:
            unique_filenames.append(filename)
        
        context_parts.append(
            f"[From: {filename}]\n"
            f"{match['text']}\n"
        )
    
    context = "\n".join(context_parts)
    print("Context for LLM:\n", context)  # Debugging line
    # Create an improved prompt that encourages direct answers
    prompt = f"""You are answering a question based on excerpts from documents.

Query: "{query}"

Document excerpts:
{context}

Instructions:
1. If the excerpts contain information that answers the query, provide a clear direct answer
2. When stating information, mention which file it came from (e.g., "According to Cv.pdf, ...")
3. If the information doesn't fully answer the query, explain what specific information is missing
4. Be natural and direct - avoid phrases like "the provided text" or "Source 2"
5. Focus on answering the question, not on describing what you can't do

Your answer:"""
    
    # Call Groq API
    try:
        client = groq.Groq(api_key=api_key)
        
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that answers questions based on document excerpts. Always cite the specific filename when providing information. Be direct and natural - if the information answers the question, say so clearly."
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama-3.3-70b-versatile",  # Fast and free
            temperature=0.1,  # Slightly more natural than 0
            max_tokens=2000,
        )
        
        answer = chat_completion.choices[0].message.content.strip()
        
        # Post-process to improve answer quality
        answer = _post_process_answer(answer, unique_filenames)
        
        return answer
    
    except Exception as e:
        return f"Error processing your query: {str(e)}"


def _post_process_answer(answer: str, filenames: list) -> str:
    """
    Post-process the answer to make it more user-friendly.
    
    Args:
        answer: Raw answer from the LLM
        filenames: List of filenames that were referenced
    
    Returns:
        Cleaned up answer
    """
    import re
    
    # Replace generic references with actual filenames
    replacements = {
        "the provided text": "the document",
        "The provided text": "The document",
        "provided text sources": "documents",
    }
    
    for old, new in replacements.items():
        answer = answer.replace(old, new)
    
    # Replace "Source X" with actual filename if possible
    if len(filenames) >= 1:
        answer = answer.replace("Source 1", filenames[0])
    if len(filenames) >= 2:
        answer = answer.replace("Source 2", filenames[1])
    if len(filenames) >= 3:
        answer = answer.replace("Source 3", filenames[2])
    
    # Special handling: If it says "Unable to answer" but contains actual answer info
    # Check if answer starts with "Unable" but has a year (indicating actual graduation info)
    if answer.startswith("Unable to answer") and re.search(r'\b(19|20)\d{2}\b', answer):
        # Check if it contains actual answer indicators
        if any(keyword in answer.lower() for keyword in ["completed", "graduated", "received", "earned", "finished"]):
            # Try to extract the actual information part
            if "Problem:" in answer:
                # Get everything after "Problem:" and clean it up
                parts = answer.split("Problem:", 1)
                if len(parts) > 1:
                    info_part = parts[1].strip()
                    # If this part has the year and completion info, use it
                    if re.search(r'\b(19|20)\d{2}\b', info_part):
                        # Remove meta-commentary about what sources do/don't say
                        info_part = re.sub(r'although.*?does not provide', '', info_part, flags=re.IGNORECASE)
                        info_part = re.sub(r'it does not provide.*?(?=[A-Z]|$)', '', info_part, flags=re.IGNORECASE)
                        info_part = re.sub(r'implying that.*?(?=[A-Z]|$)', '', info_part, flags=re.IGNORECASE)
                        
                        # Clean up extra spaces and capitalize first letter
                        info_part = ' '.join(info_part.split())
                        if info_part:
                            info_part = info_part[0].upper() + info_part[1:]
                            answer = info_part
    
    return answer.strip()

