package com.drshoes.app.messaging.service;

import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

@Component
@Slf4j
@RequiredArgsConstructor
public class TemplateRenderer {
  private static final Pattern PLACEHOLDER = Pattern.compile("\\{([a-zA-Z_]+)\\}");

  private final PlaceholderResolver resolver;

  public String render(String body, TemplateContext ctx) {
    if (body == null) return "";
    Matcher m = PLACEHOLDER.matcher(body);
    StringBuilder out = new StringBuilder();
    while (m.find()) {
      String name = m.group(1);
      String replacement = resolver.resolve(name, ctx);
      if (replacement == null) {
        log.debug("op=template.render placeholder={} outcome=unknown_left_literal", name);
        m.appendReplacement(out, Matcher.quoteReplacement(m.group()));
      } else {
        m.appendReplacement(out, Matcher.quoteReplacement(replacement));
      }
    }
    m.appendTail(out);
    return out.toString();
  }
}
