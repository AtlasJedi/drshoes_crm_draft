package com.drshoes.app.messaging.util;
public final class HtmlStripper {

    private HtmlStripper() {}

    public static String toPlainText(String html) {
        if (html == null) return null;
        String s = html
            .replaceAll("(?is)<style[^>]*>.*?</style>", "")
            .replaceAll("(?is)<script[^>]*>.*?</script>", "")
            .replaceAll("(?is)<br\\s*/?>", "\n")
            .replaceAll("(?is)</p\\s*>", "\n")
            .replaceAll("<[^>]+>", "")
            .replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'");
        return s.replaceAll("\\s+", " ").trim();
    }
}
