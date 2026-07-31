import io
import json
import os
import subprocess
import sys
import unittest

import protocol

# A title that cp1252 cannot represent, of the kind YouTube hands out daily:
# a combining accent, an emoji, and a fullwidth bar.
HOSTILE = "Ně́on 🎵 ｜ Live"


class WireEncodingTest(unittest.TestCase):
    """The regression that killed a playlist download on Windows.

    Python picks the locale encoding for stdio; on Windows that is cp1252, and
    `_send` writes raw characters (`ensure_ascii=False`). One emoji in a video
    title was `'charmap' codec can't encode characters` and a failed job. It
    never showed on macOS, where the locale encoding is already UTF-8.

    Run in a subprocess under `PYTHONIOENCODING=cp1252` because that is the
    condition itself — asserting anything in *this* process would only prove
    the test runner's own stdout is UTF-8.
    """

    def _run(self, script: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, "-c", script],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            env={**os.environ, "PYTHONIOENCODING": "cp1252"},
            capture_output=True,
            encoding="utf-8",
            timeout=30,
        )

    def test_a_title_cp1252_cannot_hold_still_reaches_the_wire(self):
        proc = self._run(
            "import protocol\n"
            f"protocol.send_event('req-1', 'download_progress', {{'title': {HOSTILE!r}}})\n"
        )

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(json.loads(proc.stdout)["data"]["title"], HOSTILE)

    def test_the_same_title_survives_a_log_line(self):
        """`log` writes to stderr, which is the same locale encoding and was the
        same crash — just one nobody would have blamed the protocol for."""
        proc = self._run(f"import protocol\nprotocol.log({HOSTILE!r})\n")

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn(HOSTILE, proc.stderr)

    def test_a_lone_surrogate_costs_a_character_not_the_job(self):
        """UTF-8 encodes almost everything, but not a lone surrogate — and
        Windows produces those whenever a filename is not valid UTF-16, which
        `surrogateescape` carries straight into a track title. One bad character
        must not be a failed download."""
        proc = self._run(
            "import protocol\n"
            "protocol.send_event('req-1', 'e', {'title': 'bad \\udce9 name'})\n"
        )

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(json.loads(proc.stdout)["data"]["title"], "bad ? name")

    def test_a_request_carrying_one_can_still_be_read(self):
        """The mirror bug: stdin decodes with the same locale encoding, so a
        request with an accent in it would have died on the way in."""
        proc = subprocess.run(
            [sys.executable, "-c", "import sys, json, protocol\n"
             "print(json.load(sys.stdin)['q'], file=sys.stderr)\n"],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            env={**os.environ, "PYTHONIOENCODING": "cp1252"},
            input=json.dumps({"q": HOSTILE}, ensure_ascii=False),
            capture_output=True,
            encoding="utf-8",
            timeout=30,
        )

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn(HOSTILE, proc.stderr)


class WireShapeTest(unittest.TestCase):
    def setUp(self):
        self.buffer = io.StringIO()
        self._real, protocol._wire = protocol._wire, self.buffer
        self.addCleanup(lambda: setattr(protocol, "_wire", self._real))

    def sent(self) -> dict:
        return json.loads(self.buffer.getvalue())

    def test_one_line_per_message_so_the_reader_can_split_on_newlines(self):
        protocol.send_event("req-1", "download_progress", {"title": HOSTILE})

        written = self.buffer.getvalue()
        self.assertTrue(written.endswith("\n"))
        self.assertEqual(written.count("\n"), 1)

    def test_characters_go_out_raw_not_escaped(self):
        """`ensure_ascii=False` is deliberate: escaping would turn every accent
        into six bytes across a listing of thousands of tracks. It is also what
        makes the stream's encoding load-bearing — hence the tests above."""
        protocol.send_result("req-1", {"title": HOSTILE})

        self.assertIn(HOSTILE, self.buffer.getvalue())
        self.assertEqual(self.sent()["result"]["title"], HOSTILE)

    def test_an_error_says_which_request_it_belongs_to(self):
        protocol.send_error("req-7", "download_failed", HOSTILE)

        self.assertEqual(self.sent(), {
            "id": "req-7",
            "ok": False,
            "error": {"code": "download_failed", "message": HOSTILE},
        })


if __name__ == "__main__":
    unittest.main()
