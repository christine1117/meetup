"""MLH hackathons: reading each event's own website for its team size."""

import json

from crawler import http
from crawler.extract.candidates import mentions_size
from crawler.sources import mlh
from crawler.text import data_text, script_text

FAQ = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
    {"@type": "Question", "name": "How big a team can be?",
     "acceptedAnswer": {"@type": "Answer", "text": "The minimum team size is two and the maximum team size is four."}}]}


def test_faq_kept_for_search_engines_is_read():
    html = f'<div id="root"></div><script type="application/ld+json">{json.dumps(FAQ)}</script>'
    text = data_text(html)
    assert "How big a team can be?" in text
    assert "The minimum team size is two and the maximum team size is four." in text
    assert "FAQPage" not in text and "Question" not in text.split("\n"), "labels are not sentences"


def test_sentences_inside_scripts_are_found_without_pairing_quotes():
    js = ("r=/[\"'`]/;a=`It's a 24-hour event for students.`;"
          "d=e[5]===f?g:(h=(0,H.jsx)(`p`,{children:`Hackers may form teams of up to 4 people.`}));"
          "c=\"Don't worry, solo hackers welcome here.\";x=\"animationIterationCount aspectRatio\"")
    text = script_text(js)
    assert "Hackers may form teams of up to 4 people." in text
    assert "Don't worry, solo hackers welcome here." in text
    assert "jsx" not in text and "===" not in text, "code between strings is dropped"


def test_size_hint():
    assert mentions_size("The minimum team size is two")
    assert mentions_size("Teams of 2-4 students")
    assert mentions_size("Teams can be 1 to 4 people")
    assert mentions_size("每隊 2 至 5 人")
    assert not mentions_size("Our team of organizers says hi")


class Site:
    """A fake hackathon website: a page built in the browser, an FAQ page, and a script."""

    def __init__(self, pages):
        self.pages, self.asked = pages, []

    def get(self, url, **_):
        self.asked.append(url)
        if url not in self.pages:
            raise RuntimeError(f"404 {url}")
        return self.pages[url]

    def get_page(self, url, **_):
        return self.get(url), url


def fake(monkeypatch, pages):
    site = Site(pages)
    monkeypatch.setattr(http, "get", site.get)
    monkeypatch.setattr(http, "get_page", site.get_page)
    monkeypatch.setattr(http, "pause", lambda: None)
    return site


def test_faq_page_is_followed(monkeypatch):
    site = fake(monkeypatch, {
        "https://h.dev/": '<p>The best student hackathon.</p><a href="/about">About</a><a href="/faq">FAQ</a><a href="https://other.dev/faq">x</a>',
        "https://h.dev/faq": "<p>How many people per team?</p><p>Teams can have up to 4 members.</p>",
        "https://h.dev/about": "<p>We are students.</p>",
    })
    pages = mlh.site_pages("https://h.dev/", http.Breaker())
    assert [p.page for p in pages][:2] == ["website", "faq"], "the FAQ is read before the about page"
    assert any("up to 4 members" in p.text for p in pages)
    assert "https://other.dev/faq" not in site.asked, "only links on the same site"


def test_scripts_read_only_when_the_pages_say_nothing(monkeypatch):
    site = fake(monkeypatch, {
        "https://h.dev/": '<div id="root"></div><script type="module" src="/assets/index-1.js"></script>',
        "https://h.dev/assets/index-1.js": "a={q:`How many people can be on my team?`,a:`Hackers may form teams of up to 4 people.`}",
    })
    pages = mlh.site_pages("https://h.dev/", http.Breaker())
    assert pages[-1].page == "site" and "teams of up to 4 people" in pages[-1].text

    fake(monkeypatch, {
        "https://h.dev/": '<p>Teams of up to 4 people.</p><script src="/assets/index-1.js"></script>',
    })
    pages = mlh.site_pages("https://h.dev/", http.Breaker())
    assert [p.page for p in pages] == ["website"], "no need to open the scripts"


def test_library_words_in_scripts_are_not_kept(monkeypatch):
    fake(monkeypatch, {
        "https://h.dev/": '<div id="root"></div><script src="/a.js"></script>',
        "https://h.dev/a.js": 'x="Error generating stack: boxFlexGroup gridRow people group order"',
    })
    assert mlh.site_pages("https://h.dev/", http.Breaker()) == []


def test_unreadable_site_is_reported_not_fatal(monkeypatch):
    fake(monkeypatch, {})
    assert mlh.site_pages("https://h.dev/", http.Breaker()) is None
