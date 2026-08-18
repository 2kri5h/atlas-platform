class LLMProvider:
    """
    Base class for all LLM providers.
    Every provider must implement process_batch().
    """

    def process_batch(self, email_batch, prompt_builder):
        raise NotImplementedError