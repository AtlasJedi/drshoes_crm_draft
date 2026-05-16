package com.drshoes.app.messaging.util;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class HtmlStripperTest {

    @Test
    void strips_basicHtml() {
        assertThat(HtmlStripper.toPlainText("<p>Hello <b>world</b></p>")).isEqualTo("Hello world");
    }

    @Test
    void collapsesWhitespace() {
        assertThat(HtmlStripper.toPlainText("Line1\n\n\nLine2   spaces")).isEqualTo("Line1 Line2 spaces");
    }

    @Test
    void preservesPlainText() {
        assertThat(HtmlStripper.toPlainText("już gotowe")).isEqualTo("już gotowe");
    }

    @Test
    void handlesNull() {
        assertThat(HtmlStripper.toPlainText(null)).isNull();
    }

    @Test
    void stripsScriptAndStyle() {
        String html = "<style>body{color:red}</style><p>Hi</p><script>alert(1)</script>";
        assertThat(HtmlStripper.toPlainText(html)).isEqualTo("Hi");
    }

    @Test
    void decodesCommonEntities() {
        assertThat(HtmlStripper.toPlainText("Tom &amp; Jerry &lt;3"))
            .isEqualTo("Tom & Jerry <3");
    }
}
