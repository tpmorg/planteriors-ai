// Exact pixel crop through Core Graphics (JavaScript for Automation, built into macOS).
// sips --cropOffset silently re-centres crops that span a full image dimension.
ObjC.import('Foundation');
ObjC.import('CoreGraphics');
ObjC.import('ImageIO');
function run(argv) {
  const [src, dest, x, y, w, h] = argv;
  const source = $.CGImageSourceCreateWithURL($.NSURL.fileURLWithPath(src), null);
  const image = $.CGImageSourceCreateImageAtIndex(source, 0, null);
  const cropped = $.CGImageCreateWithImageInRect(image, $.CGRectMake(Number(x), Number(y), Number(w), Number(h)));
  const target = $.CGImageDestinationCreateWithURL($.NSURL.fileURLWithPath(dest), $('public.jpeg'), 1, null);
  $.CGImageDestinationAddImage(target, cropped, $({ kCGImageDestinationLossyCompressionQuality: 0.92 }));
  if (!$.CGImageDestinationFinalize(target)) throw new Error('write failed');
  return `${$.CGImageGetWidth(cropped)}x${$.CGImageGetHeight(cropped)}`;
}
