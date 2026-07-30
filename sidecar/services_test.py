import unittest
from unittest import mock

import services
from services import PROBES, classify


class ClassifyTest(unittest.TestCase):
    def test_a_plain_answer_is_up(self):
        self.assertEqual(classify(200, None), {"state": "up", "detail": "200"})

    def test_a_client_error_is_still_up(self):
        # The probes are deliberately incomplete requests — AcoustID with no
        # key, Last.fm with no track. A 4xx is the service answering.
        self.assertEqual(classify(400, None), {"state": "up", "detail": "400"})
        self.assertEqual(classify(404, None), {"state": "up", "detail": "404"})

    def test_a_server_error_is_down(self):
        self.assertEqual(classify(500, None), {"state": "down", "detail": "500"})
        self.assertEqual(classify(503, None), {"state": "down", "detail": "503"})

    def test_nothing_coming_back_is_unreachable(self):
        self.assertEqual(
            classify(None, "ReadTimeout"),
            {"state": "unreachable", "detail": "ReadTimeout"},
        )
        self.assertEqual(
            classify(None, None), {"state": "unreachable", "detail": None}
        )

    def test_a_failure_wins_over_a_status(self):
        # Both can be present when a response arrives and then the body dies.
        self.assertEqual(
            classify(200, "ChunkedEncodingError"),
            {"state": "unreachable", "detail": "ChunkedEncodingError"},
        )


class ProbesTest(unittest.TestCase):
    def test_every_service_is_named_once(self):
        names = [name for name, _ in PROBES]
        self.assertEqual(len(names), len(set(names)))

    def test_every_probe_is_https(self):
        for _, url in PROBES:
            self.assertTrue(url.startswith("https://"), url)


class UserAgentTest(unittest.TestCase):
    """MusicBrainz blocks a default client string outright, so the header the
    probes actually send is the difference between an answer and a 403 — and
    the version in it has to be the caller's, not one written down here."""

    def _sent_headers(self, params):
        with mock.patch.object(services, "_probe", return_value={"name": "x"}) as probe:
            services.check("req", {"only": "lrclib", **params})
        return probe.call_args.args

    def test_the_callers_identity_reaches_the_request(self):
        _, _, user_agent = self._sent_headers({"user_agent": "Sonarche/0.9.1 (com.example)"})
        self.assertEqual(user_agent, "Sonarche/0.9.1 (com.example)")

    def test_a_call_with_no_identity_still_names_the_app(self):
        for params in ({}, {"user_agent": None}, {"user_agent": ""}):
            _, _, user_agent = self._sent_headers(params)
            self.assertTrue(user_agent.startswith("Sonarche"), user_agent)


if __name__ == "__main__":
    unittest.main()
