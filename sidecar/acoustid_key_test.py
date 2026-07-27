import unittest

from acoustid_key import classify


class ClassifyTest(unittest.TestCase):
    def test_an_accepted_lookup_is_a_good_key(self):
        self.assertEqual(
            classify({"status": "ok", "results": []}), {"valid": True, "reason": None}
        )

    def test_code_four_is_the_key_itself(self):
        self.assertEqual(
            classify({"status": "error", "error": {"code": 4, "message": "invalid API key"}}),
            {"valid": False, "reason": "invalidKey"},
        )

    def test_any_other_error_still_means_the_key_got_through(self):
        # We send the lookup without a fingerprint on purpose, so the server
        # complaining about the *request* is the expected happy path.
        self.assertEqual(
            classify({"status": "error", "error": {"code": 2, "message": "missing parameter"}}),
            {"valid": True, "reason": None},
        )

    def test_an_error_with_no_code_is_not_blamed_on_the_key(self):
        self.assertEqual(classify({"status": "error"}), {"valid": True, "reason": None})


if __name__ == "__main__":
    unittest.main()
