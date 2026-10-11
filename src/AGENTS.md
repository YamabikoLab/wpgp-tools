# WPGP Tools source guidelines

These instructions apply to product source under `src/`.

## Source organization

- Add source files only when a concrete product responsibility requires them.
- Do not create generic `shared/`, `utils/`, or `helpers/` directories without a concrete shared reason for change.
- Use the WordPress block editor extension point that best matches each concrete responsibility.
- Do not introduce adapter or abstraction layers solely for hypothetical future integrations.

## WordPress boundaries

- Prefer public WordPress APIs.
- Choose the most natural extension surface for the feature, such as a RichText format, block, block style, or editor extension.
- Keep feature logic separate from incidental DOM structure when a supported WordPress API exists.
- Do not add compatibility layers before a concrete compatibility requirement exists.

## Source documentation

- Write comments and documentation at a basic-design level of abstraction so that readers who understand the specification but cannot read the implementation can understand the specification, responsibility, purpose, behavior, and rationale. Documentation should remain understandable when read without the implementation beside it.
- In Japanese documentation and comments, do not use general English words when their meaning can be expressed naturally in Japanese. Use Japanese for explanatory concepts and terminology. Keep English only when necessary for source-code identifiers, proper nouns, standardized technical terms, or other expressions whose English spelling is required for accuracy.
- Describe behavior, rules, constraints, and decisions in terms of specification or domain concepts. Explain what is allowed, prohibited, required, or produced and why, rather than how the implementation performs the processing. Do not merely translate identifiers, expressions, data structures, algorithms, or implementation steps into natural language.
- Start each source file with a Japanese file-level documentation comment that explains the file's responsibility, purpose, and ownership. Describe the role the file provides rather than listing its implementation details.
- Add Japanese JSDoc or documentation comments to exported top-level variables, constants, functions, types, React components, HOCs, custom hooks, controllers, and other major public boundaries. Also document non-exported top-level elements when they own an important responsibility or lifecycle that is not obvious from the code alone.
- For documented functions, methods, callbacks, and similar callables, add an `@param` entry for every parameter. Explain the specification-level meaning or role of a parameter when it is not obvious from its name and type.
- For condition expressions, document the rule or decision represented by the condition at a basic-design level rather than explaining individual checks or translating the expression into prose.
- Prioritize information that is difficult to infer from the implementation itself, such as important assumptions, constraints, return-value meaning, lifecycle, and cleanup responsibilities. Keep documentation aligned when the documented responsibility or contract changes, and do not mechanically add comments to self-explanatory local variables, temporary values, or implementation steps.
- For loops and other iteration constructs, add a clear basic-design-level explanation when the purpose of the iteration is not self-explanatory. Write the comment so that readers who understand the specification but cannot read the implementation can understand what domain elements are being processed, what behavior or rule the iteration establishes, and why the iteration is necessary. Do not merely describe the loop condition, index movement, collection traversal, or other implementation steps.
